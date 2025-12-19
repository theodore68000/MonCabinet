import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

@Injectable()
export class VisioService {
  constructor(private prisma: PrismaService) {}

  // -------------------------------------------------
  // 🔑 Génération du token LiveKit
  // -------------------------------------------------
  private createAccessToken(
    identity: string,
    roomName: string,
    ttlSeconds: number,
  ) {
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: ttlSeconds,
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return token.toJwt();
  }

  // -------------------------------------------------
  // 🎥 Récupérer un token pour un RDV (médecin / patient)
  // -------------------------------------------------
  async getTokenForRdv(
    rdvId: number,
    role: "medecin" | "patient",
    userId: number,
  ) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id: rdvId },
    });

    if (!rdv) throw new NotFoundException("Rendez-vous introuvable");

    // Vérification du rôle
    if (role === "medecin" && rdv.medecinId !== userId)
      throw new UnauthorizedException();

    if (role === "patient" && rdv.patientId !== userId)
      throw new UnauthorizedException();

    // Doit être une visio
    if (rdv.typeConsultation !== "VISIO") {
      throw new BadRequestException("Ce rendez-vous n'est pas une téléconsultation.");
    }

    // Room unique par RDV
    let roomName = rdv.visioRoomName;
    if (!roomName) {
      roomName = `rdv_${rdv.id}`;
      await this.prisma.rendezVous.update({
        where: { id: rdv.id },
        data: { visioRoomName: roomName },
      });
    }

    // -------------------------------------------------
    // 🟩 LIVEKIT — CREATION AUTO COMPATIBLE SDK 1.x
    // -------------------------------------------------
    const roomService = new RoomServiceClient(
      process.env.LIVEKIT_URL!, // ⚠️ doit être wss://xxx.livekit.cloud
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
    );

    // Vérifier si la room existe en listant toutes les rooms
    const rooms = await roomService.listRooms();
    const exists = rooms.find((r) => r.name === roomName);

    if (!exists) {
      await roomService.createRoom({
        name: roomName,
        maxParticipants: 2,
        emptyTimeout: 60 * 30, // auto-suppression 30 min
      });
    }

    // -------------------------------------------------
    // ⏱ Fenêtre de validité
    // -------------------------------------------------
    const rdvDate = new Date(rdv.date);
    const [hh, mm] = rdv.heure.split(":").map(Number);
    rdvDate.setHours(hh, mm, 0, 0);

    const validFrom = new Date(rdvDate.getTime() - 5 * 60 * 1000);
    const validUntil = new Date(rdvDate.getTime() + 3 * 60 * 60 * 1000);

    const now = new Date();

    if (now > validUntil) {
      throw new BadRequestException("La téléconsultation est expirée.");
    }

    const ttlSeconds = Math.max(
      60,
      Math.floor((validUntil.getTime() - now.getTime()) / 1000),
    );

    const identity = `${role}-${userId}`;
    const token = this.createAccessToken(identity, roomName, ttlSeconds);

    return {
      roomName,
      token,
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
      patientId: rdv.patientId,
      medecinId: rdv.medecinId,
    };
  }
}
