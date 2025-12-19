'use client';

import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/* ================= TYPES ================= */

type Monthly = { month: string; count: number };

type WeekdayLoad = {
  weekday: number;
  label: string;

  // 🔴 ANCIEN (CONSERVÉ, NON UTILISÉ ICI)
  avgPerDay: number;

  // ✅ NOUVEAU : heures réellement prises
  hoursTaken?: number;
};

type Stats = {
  monthlyConsultations: Monthly[];
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
  newPatientsByMonth: Monthly[];
  weekdayLoad: WeekdayLoad[];
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
};

/* ================= UTILS ================= */

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return `${m}/${year.slice(2)}`;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042'];

/* ================= COMPONENT ================= */

export default function StatsPageClient({ stats }: { stats: Stats }) {
  const ratePercent = Math.round(stats.fillingRate.rate * 100);

  const visioData = [
    { name: 'Visio', value: stats.visio.visioCount },
    { name: 'Présentiel', value: stats.visio.physicalCount },
  ];

  return (
    <div className="space-y-8">
      {/* ================= KPIs ================= */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Taux de remplissage (30 jours)"
          value={`${ratePercent} %`}
          subtitle={`${stats.fillingRate.confirmedSlots} utilisés / ${stats.fillingRate.totalSlots}`}
        />

        <KpiCard
          label="Annulations patients (30 jours)"
          value={String(stats.patientCancellations.count)}
          subtitle="Annulations marquées côté patient"
        />

        <KpiCard
          label="Délai moyen de prise de RDV"
          value={`${stats.averageBookingDelayDays.averageDays.toFixed(1)} j`}
          subtitle="Sur les 6 derniers mois"
        />

        <KpiCard
          label="CA prévisionnel (30 jours)"
          value={`${stats.forecastRevenue.forecast.toFixed(0)} €`}
          subtitle={`${stats.forecastRevenue.confirmedFutureSlots} RDV × ${stats.forecastRevenue.slotPrice}€`}
        />
      </div>

      {/* ================= GRAPH 1 – RDV / mois ================= */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-1">Consultations sur 12 mois</h2>
          <p className="text-xs text-gray-500 mb-4">
            Nombre de RDV confirmés par mois
          </p>

          <div className="h-72 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyConsultations}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthLabel}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(v) => [`${v} RDV`, 'Consultations']}
                  labelFormatter={formatMonthLabel}
                />
                <Legend />
                <Bar dataKey="count" name="Consultations" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ================= GRAPH 2 – Visio / présentiel ================= */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-1">
            Répartition visio / présentiel
          </h2>
          <p className="text-xs text-gray-500 mb-4">Sur les 6 derniers mois</p>

          <div className="h-72 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visioData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {visioData.map((e, i) => (
                    <Cell key={e.name} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, name) => [`${v} RDV`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ================= GRAPH 3 – Nouveaux patients & charge ================= */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Nouveaux patients */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-1">Nouveaux patients</h2>
          <p className="text-xs text-gray-500 mb-4">
            Variation mensuelle après import CSV
          </p>

          <div className="h-64 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.newPatientsByMonth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthLabel}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(v) => [`${v} patients`, 'Variation']}
                  labelFormatter={formatMonthLabel}
                />
                <Bar
                  dataKey="count"
                  name="Variation patients"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charge par jour */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-lg font-medium mb-1">Charge par jour</h2>
          <p className="text-xs text-gray-500 mb-4">
            Nombre moyen d’heures prises par jour (sur 6 mois)
          </p>

          <div className="h-64 min-h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.weekdayLoad}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(v) => [`${v} h`, 'Heures prises']}
                />
                <Bar
                  dataKey="hoursTaken"
                  name="Heures prises"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= KPI CARD ================= */

function KpiCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-semibold">{value}</p>
      </div>
      {subtitle && (
        <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
