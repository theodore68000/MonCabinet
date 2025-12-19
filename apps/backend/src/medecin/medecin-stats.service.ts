import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MedecinStatsService {
  constructor(private prisma: PrismaService) {}

  private subMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() - months);
    return d;
  }

  private subDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - days);
    return d;
  }

  async getStats(medecinId: number) {
    const now = new Date();

    // -------------------------------------------------------------------
    // 1) CONSULTATIONS PAR MOIS (12 derniers mois)
    // -------------------------------------------------------------------
    const start12 = this.subMonths(now, 12);

    const rdvLast12 = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        typeSlot: 'PRIS',
      },
      select: { date: true },
      orderBy: { date: 'asc' },
    });

    const monthlyMap: Record<string, number> = {};

    for (const r of rdvLast12) {
      const d = new Date(r.date);
      if (d < start12) continue;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = (monthlyMap[key] || 0) + 1;
    }

    const monthlyConsultations = Object.entries(monthlyMap).map(
      ([month, count]) => ({ month, count }),
    );

    // -------------------------------------------------------------------
    // 2) TAUX DE REMPLISSAGE (30 jours)
    // -------------------------------------------------------------------
    const start30 = this.subDays(now, 30);

    const usedSlots = await this.prisma.rendezVous.count({
      where: {
        medecinId,
        typeSlot: 'PRIS',
        date: { gte: start30 },
      },
    });

    const totalSlots = await this.prisma.rendezVous.count({
      where: {
        medecinId,
        date: { gte: start30 },
      },
    });

    const fillingRate = {
      period: '30j',
      confirmedSlots: usedSlots,
      totalSlots,
      rate: totalSlots > 0 ? usedSlots / totalSlots : 0,
    };

    // -------------------------------------------------------------------
    // 3) ANNULATIONS PATIENTS (30 jours)
    // -------------------------------------------------------------------
    const patientCancellations = await this.prisma.rendezVous.count({
      where: {
        medecinId,
        date: { gte: start30 },
        motif: 'ANNULATION_PATIENT',
      },
    });

    // -------------------------------------------------------------------
    // 4) CHARGE / JOUR DE LA SEMAINE (6 mois)
    // -------------------------------------------------------------------
    const start6 = this.subMonths(now, 6);

    const rdv6 = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        typeSlot: 'PRIS',
        date: { gte: start6 },
      },
      select: { date: true },
    });

    const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const weekdayCount = [0, 0, 0, 0, 0, 0, 0];

    for (const r of rdv6) {
      const d = new Date(r.date);
      const wd = d.getDay();
      const index = wd === 0 ? 6 : wd - 1;
      weekdayCount[index]++;
    }

    const weekdayLoad = weekdayCount.map((count, i) => ({
      weekday: i,
      label: weekdays[i],
      avgPerDay: count / 26,
    }));

    // -------------------------------------------------------------------
    // 5) DÉLAI MOYEN DE PRISE DE RDV (6 mois)
    // -------------------------------------------------------------------
    const rdvForDelay = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        typeSlot: 'PRIS',
        date: { gte: start6 },
      },
      select: { date: true, createdAt: true },
    });

    let sumDelay = 0;
    let delayCount = 0;

    for (const r of rdvForDelay) {
      const diff = new Date(r.date).getTime() - new Date(r.createdAt).getTime();
      if (diff > 0) {
        sumDelay += diff / (1000 * 60 * 60 * 24);
        delayCount++;
      }
    }

    const averageDelay = delayCount > 0 ? sumDelay / delayCount : 0;

    // -------------------------------------------------------------------
    // 6) CA PRÉVISIONNEL (30 jours)
    // -------------------------------------------------------------------
    const futureConfirmed = await this.prisma.rendezVous.count({
      where: {
        medecinId,
        typeSlot: 'PRIS',
        date: { gte: now },
      },
    });

    const slotPrice = 30;
    const forecastRevenue = {
      horizon: '30 jours',
      slotPrice,
      confirmedFutureSlots: futureConfirmed,
      forecast: futureConfirmed * slotPrice,
    };

    // -------------------------------------------------------------------
    // 7) NOUVEAUX PATIENTS PAR MOIS (12 mois)
    //    → remplace totalement medecinTraitantId
    // -------------------------------------------------------------------
    const firstRdvByPatient = await this.prisma.rendezVous.groupBy({
      by: ['patientId'],
      where: {
        medecinId,
        patientId: { not: null },
      },
      _min: { date: true },
    });

    const newPatientsMap: Record<string, number> = {};

    for (const entry of firstRdvByPatient) {
      const first = entry._min.date;
      if (!first) continue;

      const d = new Date(first);
      if (d < start12) continue;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      newPatientsMap[key] = (newPatientsMap[key] || 0) + 1;
    }

    const newPatientsByMonth = Object.entries(newPatientsMap).map(
      ([month, count]) => ({ month, count }),
    );

    // -------------------------------------------------------------------
    // 8) VISIO VS PRÉSENTIEL (6 mois)
    // -------------------------------------------------------------------
    const rdvVisio = await this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        date: { gte: start6 },
      },
      select: { typeConsultation: true },
    });

    const visioCount = rdvVisio.filter(r => r.typeConsultation === 'VISIO').length;
    const physicalCount = rdvVisio.filter(r => r.typeConsultation === 'PRESENTIEL').length;

    const visio = {
      period: '6 mois',
      visioCount,
      physicalCount,
    };

    // -------------------------------------------------------------------
    // 9) RÉSULTAT FINAL
    // -------------------------------------------------------------------
    return {
      monthlyConsultations,
      fillingRate,
      patientCancellations: {
        period: '30 jours',
        count: patientCancellations,
      },
      averageBookingDelayDays: {
        period: '6 mois',
        averageDays: averageDelay,
      },
      newPatientsByMonth,
      weekdayLoad,
      visio,
      forecastRevenue,
    };
  }
}
