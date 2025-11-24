"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import AddSlotModal, { ModalMode } from "./components/AddSlotModal";

type MedecinSession = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
};

type Rdv = {
  id: number;
  date: string; // ISO
  heure: string; // "HH:MM"
  motif?: string | null;
  statut: string;
  patient?: {
    id: number;
    nom: string;
    prenom: string;
  } | null;
};

type ViewMode = "day" | "week";

type Horaires = {
  [key: string]: string[]; // ex: "lundi": ["08:00-12:00", "14:00-18:00"]
};

const DAY_NAMES = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

/* -------------------------------------------------------
   🔥 FIX PRINCIPAL : VERSION FIABLE DE GETWEEKSTART
---------------------------------------------------------*/
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dim, 1 = lun...

  // Lundi = 1 → diff 0
  // Mardi = 2 → diff 1
  // ...
  // Dimanche = 0 → diff 6
  const diff = day === 0 ? 6 : day - 1;

  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function MedecinDashboard() {
  const router = useRouter();

  const [medecin, setMedecin] = useState<MedecinSession | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [horaires, setHoraires] = useState<Horaires | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [modal, setModal] = useState<{
    open: boolean;
    date: string;
    heure: string;
    mode: ModalMode;
    rdvId?: number | null;
    initialPatientId?: number | null;
  }>({
    open: false,
    date: "",
    heure: "",
    mode: "dayButton",
    rdvId: null,
    initialPatientId: null,
  });

  /* -------------------------------------------------------
     SESSION MEDECIN
  ---------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("medecinSession");
    if (!saved) {
      router.push("/medecin/login");
      return;
    }
    try {
      setMedecin(JSON.parse(saved));
    } catch {
      localStorage.removeItem("medecinSession");
      router.push("/medecin/login");
    }
  }, [router]);

  /* -------------------------------------------------------
     HELPERS
  ---------------------------------------------------------*/
  const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });

  const weekStart = getWeekStart(selectedDate);

  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  // Créneaux de 15 minutes : 08:00 → 18:00
  const hours = Array.from({ length: (18 - 8) * 4 }, (_, i) => {
    const totalMin = 8 * 60 + i * 15;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const mm = String(totalMin % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  });

  const getDayKey = (d: Date) => DAY_NAMES[d.getDay()];

  const isWithinHoraires = (date: Date, heure: string) => {
    if (!horaires) return false;
    const dayKey = getDayKey(date);
    const plages = (horaires[dayKey] || []) as string[];
    if (!plages || plages.length === 0) return false;

    const [h, m] = heure.split(":").map(Number);
    const minutes = h * 60 + m;

    for (const plage of plages) {
      const [start, end] = plage.split("-");
      if (!start || !end) continue;
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      if (minutes >= startMin && minutes < endMin) {
        return true;
      }
    }
    return false;
  };

  /* -------------------------------------------------------
     FETCH HORAIRES MEDECIN
  ---------------------------------------------------------*/
  useEffect(() => {
    if (!medecin) return;

    const fetchMedecinDetails = async () => {
      try {
        const res = await fetch(`http://localhost:3001/medecin/${medecin.id}`);
        const data = await res.json();
        setHoraires((data && data.horaires) || null);
      } catch (e) {
        console.error(e);
        setHoraires(null);
      }
    };

    fetchMedecinDetails();
  }, [medecin]);

  /* -------------------------------------------------------
     FETCH PLANNING (fix lundi)
  ---------------------------------------------------------*/
  const fetchPlanning = async () => {
    if (!medecin) return;

    setLoading(true);
    setError("");

    let start = new Date(selectedDate);
    let end = new Date(selectedDate);

    if (viewMode === "day") {
      // journée du selectedDate
      start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);

      end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);
    } else {
      // semaine entière
      start = getWeekStart(selectedDate);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 7);
      end.setHours(0, 0, 0, 0);
    }

    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      const res = await fetch(
        `http://localhost:3001/rdv/medecin/${medecin.id}?${params.toString()}`,
      );

      const data = await res.json();

      if (!res.ok || data.success === false) {
        setError(data.message || "Impossible de charger les rendez-vous.");
        setRdvs([]);
        return;
      }

      setRdvs(data.rdvs || data);
    } catch {
      setError("Erreur serveur.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanning();
  }, [medecin, selectedDate, viewMode]);

  /* -------------------------------------------------------
     NAVIGATION
  ---------------------------------------------------------*/
  const goNextWeek = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 7);
      return nd;
    });

  const goPrevWeek = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 7);
      return nd;
    });

  const goNextDay = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + 1);
      return nd;
    });

  const goPrevDay = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() - 1);
      return nd;
    });

  /* -------------------------------------------------------
     RDV LOOKUP
  ---------------------------------------------------------*/
  const getCellRdv = (dateStr: string, heure: string) =>
    rdvs.find((r) => r.date.slice(0, 10) === dateStr && r.heure === heure);

  /* -------------------------------------------------------
     OPEN MODAL
  ---------------------------------------------------------*/
  const openSlotModal = (
    date: string,
    heure: string,
    mode: ModalMode,
    rdvId?: number | null,
    initialPatientId?: number | null,
  ) => {
    setModal({
      open: true,
      date,
      heure,
      mode,
      rdvId: rdvId ?? null,
      initialPatientId: initialPatientId ?? null,
    });
  };

  /* -------------------------------------------------------
     RENDER
  ---------------------------------------------------------*/
  return (
    <div className="flex bg-slate-950 text-white min-h-screen">
      <Sidebar />

      <div className="flex-1 p-8 max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">
              Dashboard médecin
            </h1>
            <p className="text-slate-400">
              Dr {medecin?.prenom} {medecin?.nom}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 rounded ${
                viewMode === "day"
                  ? "bg-emerald-500 text-black"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 rounded ${
                viewMode === "week"
                  ? "bg-emerald-500 text-black"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              Semaine
            </button>
          </div>
        </div>

        {/* PLANNING */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Planning</h2>

            {viewMode === "day" ? (
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={goPrevDay}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ◀
                </button>
                <span>{formatDate(selectedDate)}</span>
                <button
                  onClick={goNextDay}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ▶
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={goPrevWeek}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ◀
                </button>
                <span className="text-slate-300">
                  Semaine du {toISODate(weekStart)}
                </span>
                <button
                  onClick={goNextWeek}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* LOADING / ERROR */}
          {loading && (
            <p className="text-slate-400 text-sm">Chargement du planning…</p>
          )}
          {error && !loading && (
            <p className="text-red-400 text-sm mb-2">{error}</p>
          )}
          {!loading && !error && !horaires && (
            <p className="text-slate-400 text-sm">
              Chargement des horaires du médecin…
            </p>
          )}

          {/* MODE JOUR */}
          {viewMode === "day" && !loading && !error && horaires && (
            <>
              {(() => {
                const dayDateStr = toISODate(selectedDate);
                const daySlots = hours.filter((h) =>
                  isWithinHoraires(selectedDate, h),
                );

                if (daySlots.length === 0) {
                  return (
                    <p className="text-slate-500 text-sm">
                      Aucun créneau aujourd’hui.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2">
                    {daySlots.map((hour) => {
                      const rdv = getCellRdv(dayDateStr, hour);
                      const isBlocked = rdv?.statut === "indisponible";
                      const isBooked = !!(rdv && rdv.patient);

                      let displayLabel = "Libre";
                      let cardClass =
                        "bg-blue-600/20 border-blue-500/40 text-blue-100";

                      if (isBlocked) {
                        displayLabel = "";
                        cardClass =
                          "bg-slate-900/40 border-slate-700 text-slate-500";
                      } else if (isBooked && rdv?.patient) {
                        displayLabel = `${rdv.patient.prenom} ${rdv.patient.nom}`;
                        cardClass =
                          "bg-emerald-600/20 border-emerald-500/40 text-emerald-100";
                      }

                      return (
                        <div
                          key={hour}
                          className={`border px-4 py-3 rounded-xl flex justify-between items-center cursor-pointer hover:brightness-110 transition ${cardClass}`}
                          onClick={() =>
                            openSlotModal(
                              dayDateStr,
                              hour,
                              "click",
                              rdv?.id ?? null,
                              rdv?.patient?.id ?? null,
                            )
                          }
                        >
                          <div>
                            <p className="font-semibold">
                              {hour}
                              {displayLabel && ` — ${displayLabel}`}
                            </p>

                            {rdv?.motif && !isBlocked && (
                              <p className="text-xs text-slate-200 italic mt-1">
                                {rdv.motif}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {/* MODE SEMAINE */}
          {viewMode === "week" && !loading && !error && horaires && (
            <div className="overflow-x-auto mt-2">
              <div className="min-w-[900px]">
                {/* En-têtes jours */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] text-center mb-2 text-xs">
                  <div></div>
                  {daysOfWeek.map((d) => (
                    <div key={d.toISOString()} className="text-slate-300">
                      <div className="font-semibold text-sm">
                        {d.toLocaleDateString("fr-FR", { weekday: "short" })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {d.toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grille heures × jours */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] text-[11px]">
                  {hours.map((hour) => (
                    <Fragment key={hour}>
                      {/* Colonne heure */}
                      <div className="h-10 flex items-center justify-center text-slate-400 border-t border-slate-800">
                        {hour}
                      </div>

                      {/* Colonnes jours */}
                      {daysOfWeek.map((d) => {
                        const dateStr = toISODate(d);
                        const rdv = getCellRdv(dateStr, hour);
                        const inHoraires = isWithinHoraires(d, hour);
                        const isBooked = !!(rdv && rdv.patient);
                        const isBlocked = rdv?.statut === "indisponible";

                        // CLICK SUR TOUTES LES CASES
                        const handleClick = () =>
                          openSlotModal(
                            dateStr,
                            hour,
                            "click",
                            rdv?.id ?? null,
                            rdv?.patient?.id ?? null,
                          );

                        // === CAS 1 : RDV EXISTANT (patient / libre / bloqué)
                        if (rdv) {
                          if (isBlocked) {
                            return (
                              <div
                                key={dateStr + hour}
                                className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer hover:brightness-110 transition"
                                onClick={handleClick}
                              >
                                <div className="h-full rounded-lg px-2 flex items-center justify-center bg-slate-900/40 border border-slate-700 text-slate-500">
                                  {/* pas de label visible */}
                                </div>
                              </div>
                            );
                          }

                          const cardClass = isBooked
                            ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-100"
                            : "bg-blue-600/20 border-blue-500/60 text-blue-100";

                          const displayLabel = isBooked
                            ? `${rdv.patient!.prenom} ${rdv.patient!.nom}`
                            : "Libre";

                          return (
                            <div
                              key={dateStr + hour}
                              className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer hover:brightness-110 transition"
                              onClick={handleClick}
                            >
                              <div
                                className={`h-full rounded-lg px-2 flex flex-col justify-center ${cardClass}`}
                              >
                                <span className="font-semibold truncate">
                                  {displayLabel}
                                </span>
                                {rdv.motif && (
                                  <span className="text-[10px] text-slate-200 italic truncate">
                                    {rdv.motif}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // === CAS 2 : AUCUN RDV EN BASE
                        return (
                          <div
                            key={dateStr + hour}
                            className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer hover:brightness-110 transition"
                            onClick={handleClick}
                          >
                            <div
                              className={`h-full rounded-lg px-2 flex items-center justify-center ${
                                inHoraires
                                  ? "bg-blue-600/20 border border-blue-500/60 text-blue-100"
                                  : "bg-slate-900/40 border border-slate-700 text-slate-500"
                              }`}
                            >
                              <span className="truncate">
                                {inHoraires ? "Libre" : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOUTON AJOUTER */}
        <div className="mt-6">
          <button
            onClick={() =>
              openSlotModal(
                toISODate(selectedDate),
                "",
                viewMode === "day" ? "dayButton" : "weekButton",
                null,
                null,
              )
            }
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold py-3 rounded-xl"
          >
            Ajouter un créneau
          </button>
        </div>
      </div>

      {/* MODAL */}
      <AddSlotModal
        open={modal.open}
        date={modal.date}
        heure={modal.heure}
        mode={modal.mode}
        rdvId={modal.rdvId ?? undefined}
        initialPatientId={modal.initialPatientId ?? undefined}
        medecinId={medecin?.id}
        onClose={(refresh: boolean) => {
          setModal({
            open: false,
            date: "",
            heure: "",
            mode: "dayButton",
            rdvId: null,
            initialPatientId: null,
          });
          if (refresh) fetchPlanning();
        }}
      />
    </div>
  );
}
