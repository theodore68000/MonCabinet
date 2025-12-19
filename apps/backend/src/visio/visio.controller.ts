import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { VisioService } from "./visio.service";
import { PaiementService } from "../paiement/paiement.service";
import { PrismaService } from "../prisma/prisma.service";

// ⚠️ Remplace-le ensuite par ton vrai guard patient
class FakePatientGuard {}

class GetVisioTokenDto {
  rdvId: number;
  role: "medecin" | "patient";
  userId: number;
}

@Controller("visio")
export class VisioController {
  constructor(
    private readonly visioService: VisioService,
    private readonly paiementService: PaiementService,
    private readonly prisma: PrismaService,
  ) {}

  // ─────────────────────────────────────────
  // 🔵 Récupération token visio (existant)
  // ─────────────────────────────────────────
  @Post("token")
  async getToken(@Body() body: GetVisioTokenDto) {
    console.log("🔵 /visio/token called", body);

    try {
      const result = await this.visioService.getTokenForRdv(
        body.rdvId,
        body.role,
        body.userId,
      );

      console.log("🟢 Token généré OK pour", {
        rdvId: body.rdvId,
        role: body.role,
        userId: body.userId,
      });

      return result;
    } catch (err) {
      console.error("❌ ERREUR /visio/token :", err);
      throw err;
    }
  }

  // ─────────────────────────────────────────
  // 🟣 Accès visio (nouveau) → paiement obligatoire
  // ─────────────────────────────────────────
  @Get("join/:rdvId")
  @UseGuards(FakePatientGuard as any)
  async joinVisio(@Param("rdvId") rdvId: string, @Req() req: any) {
    const patientId = req.user?.id ?? null; // ⚠️ Ton guard mettra req.user.id
    const id = Number(rdvId);

    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id },
      include: { paiement: true },
    });

    if (!rdv) {
      throw new Error("Rendez-vous introuvable");
    }

    // si ce n'est PAS une visio → accès direct
    if (rdv.typeConsultation !== "VISIO") {
      return { canJoin: true, reason: "PRESENTIEL" };
    }

    // si déjà payé → accès direct
    if (rdv.paiement?.status === "SUCCES") {
      return {
        canJoin: true,
        visioRoomName: rdv.visioRoomName,
      };
    }

    // sinon → créer PaymentIntent Stripe
    const result =
      await this.paiementService.createOrGetPaymentIntentForRdvVisio(
        id,
        patientId,
      );

    if (result.alreadyPaid) {
      return { canJoin: true, visioRoomName: rdv.visioRoomName };
    }

    // renvoyer clientSecret Stripe Elements
    return {
      canJoin: false,
      needPayment: true,
      clientSecret: result.clientSecret,
    };
  }
}
