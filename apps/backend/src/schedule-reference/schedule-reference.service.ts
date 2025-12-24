// apps/backend/src/schedule-reference/schedule-reference.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type DayKey =
  | 'lundi'
  | 'mardi'
  | 'mercredi'
  | 'jeudi'
  | 'vendredi'
  | 'samedi'
  | 'dimanche';

const DAYS: DayKey[] = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

@Injectable()
export class ScheduleReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  /* =====================================================
     HELPERS TEMPS
  ===================================================== */

  private timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private toHHMM(min: number): string {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(min % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  private getDayKeyFromISO(dateIso: string): DayKey {
    const d = new Date(`${dateIso}T00:00:00.000Z`);
    const map: DayKey[] = [
      'dimanche',
      'lundi',
      'mardi',
      'mercredi',
      'jeudi',
      'vendredi',
      'samedi',
    ];
    return map[d.getUTCDay()];
  }

  /* =====================================================
     NORMALISATION PAYLOAD
  ===================================================== */

  private normalizeWeeklyPayload(
    input: Record<string, string[]>,
  ): Record<DayKey, string[]> {
    const out: Record<DayKey, string[]> = {
      lundi: [],
      mardi: [],
      mercredi: [],
      jeudi: [],
      vendredi: [],
      samedi: [],
      dimanche: [],
    };

    for (const day of DAYS) {
      const arr = Array.isArray(input?.[day]) ? input[day] : [];

      out[day] = Array.from(
        new Set(
          arr
            .map((v) => (v || '').trim())
            .filter((v) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(v))
            .filter((v) => {
              const [s, e] = v.split('-');
              return this.timeToMinutes(e) > this.timeToMinutes(s);
            }),
        ),
      ).sort(
        (a, b) =>
          this.timeToMinutes(a.split('-')[0]) -
          this.timeToMinutes(b.split('-')[0]),
      );
    }

    return out;
  }

  /* =====================================================
     GÉNÉRATION SLOTS RÉELS (ONE-SHOT)
  ===================================================== */

  private async generateFreeSlotsFromReference(
    medecinId: number,
    weekly: Record<DayKey, string[]>,
  ) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const oneYearLater = new Date(today);
    oneYearLater.setUTCDate(today.getUTCDate() + 365);

    // Tous les slots existants = intouchables
    const existing = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        date: {
          gte: today,
          lte: oneYearLater,
        },
      },
      select: { date: true, heure: true },
    });

    const occupied = new Set(
      existing.map((r) => {
        const y = r.date.getUTCFullYear();
        const m = String(r.date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(r.date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}_${r.heure}`;
      }),
    );

    const toCreate: any[] = [];

    for (
      let d = new Date(today);
      d <= oneYearLater;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${dd}`;

      const dayKey = this.getDayKeyFromISO(isoDate);
      const intervals = weekly[dayKey] || [];

      for (const interval of intervals) {
        const [start, end] = interval.split('-');
        let cur = this.timeToMinutes(start);
        const endMin = this.timeToMinutes(end);

        while (cur < endMin) {
          const heure = this.toHHMM(cur);
          const key = `${isoDate}_${heure}`;

          if (!occupied.has(key)) {
            toCreate.push({
              medecinId,
              date: new Date(`${isoDate}T00:00:00.000Z`),
              heure,
              typeSlot: 'LIBRE',
            });
          }

          cur += 15;
        }
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.rendezVous.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }
  }

  /* =====================================================
     API PUBLIQUE
  ===================================================== */

  /**
   * GÉNÉRATEUR ONE-SHOT
   * - enregistre la structure
   * - génère des slots LIBRES réels sur 1 an
   * - n'impose PLUS RIEN après
   */
  async updateHorairesReference(
    medecinId: number,
    horairesReference: Record<string, string[]>,
  ) {
    if (!medecinId || isNaN(medecinId)) {
      throw new BadRequestException('medecinId invalide.');
    }

    const normalized = this.normalizeWeeklyPayload(horairesReference);

    await this.prisma.medecin.update({
      where: { id: medecinId },
      data: { horairesReference: normalized },
    });

    await this.generateFreeSlotsFromReference(medecinId, normalized);

    return {
      success: true,
      horairesReference: normalized,
    };
  }
}
