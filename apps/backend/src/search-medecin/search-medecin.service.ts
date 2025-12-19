import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SearchMedecinService {
  constructor(private prisma: PrismaService) {}

  /* -------------------------------------------------------------
   * 🔎 Recherche rapide : autocomplete nom/prenom
   * GET /search-medecin/search-names?q=
   ------------------------------------------------------------- */
async searchNames(q: string) {
  if (!q || q.trim().length < 1) return [];

  return this.prisma.medecin.findMany({
    where: {
      OR: [
        { nom: { contains: q, mode: "insensitive" } },
        { prenom: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,        // <-- OBLIGATOIRE
      nom: true,       // <-- POUR L'AFFICHAGE
      prenom: true,    // <-- POUR L'AFFICHAGE
      specialite: true,
    },
    take: 10,
  });
}

  /* -------------------------------------------------------------
   * 🔎 Recherche avancée des médecins
   * Filtres : spécialités, rayon, géoloc, avis, délai prochain RDV
   ------------------------------------------------------------- */
  async search(params: {
    specialites?: string[];
    rayon?: number;
    patientLat?: number;
    patientLng?: number;
    noteMin?: number;
    delai?: number;
  }) {
    const {
      specialites,
      rayon,
      patientLat,
      patientLng,
      noteMin,
      delai,
    } = params;

    /* ---------------------------------------------------------
     * 1) On récupère tous les médecins + avis
     --------------------------------------------------------- */
    const medecins = await this.prisma.medecin.findMany({
      include: {
        avisMedecin: true,
      },
    });

    const results: any[] = [];

    /* ---------------------------------------------------------
     * 2) Filtrage + enrichissement
     --------------------------------------------------------- */
    for (const m of medecins) {
      // Spécialité
      if (specialites && specialites.length > 0) {
        if (!m.specialite || !specialites.includes(m.specialite)) continue;
      }

      // Avis
      const avis = m.avisMedecin;
      const noteMoyenne =
        avis.length > 0
          ? avis.reduce((s, a) => s + a.note, 0) / avis.length
          : null;

      if (noteMin && noteMoyenne !== null && noteMoyenne < noteMin) continue;

      // Distance géographique
      let distanceKm: number | null = null;
      if (patientLat && patientLng && m.latitude && m.longitude) {
        distanceKm = this.haversine(
          patientLat,
          patientLng,
          m.latitude,
          m.longitude
        );
        if (rayon && distanceKm > rayon) continue;
      }

      // Prochain créneau disponible
      const next = await this.computeNextAvailability(m.id, delai);
      if (!next) continue;

      results.push({
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        specialite: m.specialite,
        adresseCabinet: m.adresseCabinet,
        latitude: m.latitude,
        longitude: m.longitude,

        noteMoyenne,
        nombreAvis: avis.length,

        nextAvailable: next,
      });
    }

    /* ---------------------------------------------------------
     * 3) Limiter aux 5 + trier par distance
     --------------------------------------------------------- */
    if (results.length > 5) {
      if (patientLat && patientLng) {
        results.sort((a, b) => {
          const da = this.haversine(
            patientLat,
            patientLng,
            a.latitude,
            a.longitude
          );
          const db = this.haversine(
            patientLat,
            patientLng,
            b.latitude,
            b.longitude
          );
          return da - db;
        });
      }
      return results.slice(0, 5);
    }

    return results;
  }

  /* ---------------------------------------------------------
   * 📍 Calcul distance Haversine
   --------------------------------------------------------- */
  private haversine(lat1, lon1, lat2, lon2): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(d: number) {
    return (d * Math.PI) / 180;
  }

  /* ---------------------------------------------------------
   * 📅 Prochain créneau libre réel
   --------------------------------------------------------- */
  private async computeNextAvailability(
    medecinId: number,
    delai?: number
  ): Promise<Date | null> {
    const now = new Date();

    const minDate = new Date(now);
    if (delai) minDate.setDate(minDate.getDate() + delai);

    const slot = await this.prisma.rendezVous.findFirst({
      where: {
        medecinId,
        typeSlot: "LIBRE",
        date: { gte: minDate },
      },
      orderBy: [{ date: "asc" }, { heure: "asc" }],
    });

    return slot ? slot.date : null;
  }
}
