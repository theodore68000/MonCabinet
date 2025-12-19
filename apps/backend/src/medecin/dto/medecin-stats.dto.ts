// src/medecin/dto/medecin-stats.dto.ts
export class MedecinStatsDto {
  monthlyConsultations: { month: string; count: number }[];
  fillingRate: {
    period: string;
    confirmedSlots: number;
    totalSlots: number;
    rate: number;
  };
  patientCancellations: {
    period: string;
    count: number;
  };
  averageBookingDelayDays: {
    period: string;
    averageDays: number;
  };
  newPatientsByMonth: { month: string; count: number }[];
  weekdayLoad: { weekday: number; label: string; avgPerDay: number }[];
  visio: {
    period: string;
    visioCount: number;
    physicalCount: number;
  };
  forecastRevenue: {
    horizon: string;
    slotPrice: number;
    confirmedFutureSlots: number;
    forecast: number;
  };
}
