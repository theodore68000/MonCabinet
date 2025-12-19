"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import AddSlotModal, { ModalMode } from "./components/AddSlotModal";
import ScheduleDrawer from "./components/ScheduleDrawer";

/* -------------------------------------------------------
   TYPES
---------------------------------------------------------*/
type MedecinSession = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
};

type Rdv = {
  id: number;
  date: string;
  heure: string;
  motif?: string | null;
  statut: string;
  typeConsultation?: string | null;
  typeSlot?: string | null;
  patient?: {
    id: number;
    nom: string;
    prenom: string;
  } | null;
  proche?: {
    id: number;
    nom: string;
    prenom: string;
  } | null;
  displayLabel?: string | null;
};

type ViewMode = "day" | "week";

type Horaires = {
  [key: string]: string[];
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
   GET WEEK START
---------------------------------------------------------*/
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** helper pour rendre le drag "invisible" (pas de ghost / photo) */
const makeDragImageInvisible = (e: any) => {
  if (e && e.dataTransfer) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    e.dataTransfer.setDragImage(img, 0, 0);
  }
};

/* -------------------------------------------------------
   COMPONENT
---------------------------------------------------------*/
export default function MedecinDashboard() {
  const router = useRouter();

  /* SESSION */
  const [medecin, setMedecin] = useState<MedecinSession | null>(null);

  /* HORAIRES / PLANNING */
  const [horaires, setHoraires] = useState<Horaires | null>(null);
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* VUE */
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  /* DRAWER HORAIRES */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"day" | "week">("day");
  const [drawerDate, setDrawerDate] = useState<Date>(new Date());

  const openHorairesDrawer = (mode: "day" | "week", date: Date) => {
    setDrawerMode(mode);
    setDrawerDate(date);
    setDrawerOpen(true);
  };

  /* MODAL RDV */
  const [modal, setModal] = useState<{
    open: boolean;
    date: string;
    heure: string;
    mode: ModalMode;
    rdvId?: number | null;
    initialPatientId?: number | null;
    initialTypeConsultation?: string | null;
  }>({
    open: false,
    date: "",
    heure: "",
    mode: "dayButton",
    rdvId: null,
    initialPatientId: null,
    initialTypeConsultation: null,
  });

  /* DRAG & DROP (médecin) */
  const [dragData, setDragData] = useState<{
    rdvId: number | null;
    fromDate: string; // "YYYY-MM-DD"
    fromHour: string;
    fromIsVirtual: boolean;
  } | null>(null);

  /* -------------------------------------------------------
     SESSION
  ---------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("medecinSession");
    if (!saved) return router.push("/medecin/login");

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
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

  const toLocalISOString = (d: Date) => {
    // Convertit la date locale en ISO en compensant le décalage
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString();
  };

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

  const hours = Array.from({ length: (23 - 7) * 4 }, (_, i) => {
    const min = 7 * 60 + i * 15;
    const hh = String(Math.floor(min / 60)).padStart(2, "0");
    const mm = String(min % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  });

  const getDayKey = (d: Date) => DAY_NAMES[d.getDay()];

  const isWithinHoraires = (date: Date, heure: string) => {
    if (!horaires) return false;
    const key = getDayKey(date);
    const slots = horaires[key] || [];
    if (!slots.length) return false;

    const [h, m] = heure.split(":").map(Number);
    const current = h * 60 + m;

    for (const interval of slots) {
      const [s, e] = interval.split("-");
      const [sh, sm] = s.split(":").map(Number);
      const [eh, em] = e.split(":").map(Number);
      if (current >= sh * 60 + sm && current < eh * 60 + em) return true;
    }
    return false;
  };

  /* -------------------------------------------------------
     UNIFICATION AFFICHAGE DES CRENEAUX
  ---------------------------------------------------------*/
const computeSlotVisual = (rdv: Rdv | undefined, inHoraires: boolean) => {
  const slotType = (rdv?.typeSlot || "").toLowerCase() as
    | "hors"
    | "libre"
    | "pris"
    | "bloque"
    | "";

  if (slotType === "bloque") {
    return {
      label: "Bloqué",
      className:
        "bg-red-600/20 border border-red-500/60 text-white font-semibold",
      showMotif: false,
    };
  }

  if (slotType === "pris") {
    const prenom =
      rdv?.patient?.prenom ||
      rdv?.proche?.prenom ||
      rdv?.patientIdentity?.prenom ||
      "";

    const nom =
      rdv?.patient?.nom ||
      rdv?.proche?.nom ||
      rdv?.patientIdentity?.nom ||
      "";

    const identite =
      prenom || nom ? `${prenom} ${nom}`.trim() : "RDV";

    const consultation =
      rdv?.typeConsultation === "VISIO" ? "Visio" : "Cabinet";

    return {
      label: `${identite} — ${consultation}`,
      className:
        "bg-emerald-600/20 border border-emerald-500/60 text-emerald-100",
      showMotif: true,
    };
  }

  if (slotType === "libre" || inHoraires) {
    return {
      label: "Libre",
      className: "bg-fuchsia-600 border border-fuchsia-400 text-white",
      showMotif: false,
    };
  }

  // ✅ FALLBACK ABSOLU — JAMAIS undefined
  return {
    label: "",
    className: "bg-slate-900/40 border border-slate-700 text-slate-500",
    showMotif: false,
  };
};

  /* -------------------------------------------------------
     FETCH HORAIRES
  ---------------------------------------------------------*/
  const fetchHoraires = async () => {
    if (!medecin) return;

    try {
      const res = await fetch(`http://localhost:3001/medecin/${medecin.id}`);
      const data = await res.json();

      const parsed =
        typeof data.horaires === "string" ? JSON.parse(data.horaires) : data.horaires;

      setHoraires(parsed);
    } catch {
      setHoraires(null);
    }
  };

  useEffect(() => {
    if (medecin) fetchHoraires();
  }, [medecin]);

  /* -------------------------------------------------------
     FETCH PLANNING
  ---------------------------------------------------------*/
  const fetchPlanning = async () => {
    if (!medecin) return;

    setLoading(true);
    setError("");

    let start = new Date(selectedDate);
    let end = new Date(selectedDate);

    if (viewMode === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start = getWeekStart(selectedDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    }

    try {
      const res = await fetch(
        `http://localhost:3001/rdv/medecin/${medecin.id}?start=${encodeURIComponent(
          toLocalISOString(start)
        )}&end=${encodeURIComponent(toLocalISOString(end))}`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Erreur planning");

      setRdvs(data.rdvs || data);
    } catch {
      setError("Erreur chargement planning.");
      setRdvs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (medecin) fetchPlanning();
  }, [medecin, selectedDate, viewMode]);

  /* -------------------------------------------------------
     NAVIGATION
  ---------------------------------------------------------*/
  const goNextDay = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(d.getDate() + 1);
      return nd;
    });

  const goPrevDay = () =>
    setSelectedDate((d) => {
      const nd = new Date(d);
      nd.setDate(d.getDate() - 1);
      return nd;
    });

  const goNextWeek = () =>
    setSelectedDate((d) => {
      const monday = getWeekStart(d);
      const next = new Date(monday);
      next.setDate(monday.getDate() + 7);
      return next;
    });

  const goPrevWeek = () =>
    setSelectedDate((d) => {
      const monday = getWeekStart(d);
      const prev = new Date(monday);
      prev.setDate(monday.getDate() - 7);
      return prev;
    });

  /* -------------------------------------------------------
     UTIL
  ---------------------------------------------------------*/
  const toLocalDateKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const getCellRdv = (date: string, heure: string) =>
    rdvs.find((rdv) => toLocalDateKey(rdv.date) === date && rdv.heure === heure);

  const openSlotModal = (
    date: string,
    heure: string,
    mode: ModalMode,
    rdvId?: number | null,
    initialPatientId?: number | null,
    typeConsulta?: string | null
  ) => {
    setModal({
      open: true,
      date,
      heure,
      mode,
      rdvId: rdvId ?? null,
      initialPatientId: initialPatientId ?? null,
      initialTypeConsultation: typeConsulta ?? null,
    });
  };

  /* -------------------------------------------------------
     DRAG & DROP LOGIQUE MÉDECIN
  ---------------------------------------------------------*/
const handleDropMedecin = async (toDateStr: string, toHour: string) => {
  if (!dragData || !medecin) return;

  const { fromDate, fromHour } = dragData;
  setDragData(null);

  // même case → rien
  if (fromDate === toDateStr && fromHour === toHour) {
    return;
  }

  const fromRdv = getCellRdv(fromDate, fromHour);
  const toRdv = getCellRdv(toDateStr, toHour);

  const fromRealId = fromRdv?.id ?? null;
  const toRealId = toRdv?.id ?? null;

  // ------------------------------------------------------------
  // 1) RDV réel → RDV réel : SWAP
  // ------------------------------------------------------------
  if (fromRealId && toRealId) {
    try {
      const res = await fetch("http://localhost:3001/rdv/swap/medecin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstId: fromRealId,
          secondId: toRealId,
        }),
      });

      if (!res.ok) {
        alert("Impossible d'échanger ces rendez-vous.");
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur lors de l'échange des rendez-vous.");
    }
    return;
  }

  // ------------------------------------------------------------
  // 2) RDV réel → case vide
  // 👉 MOVE atomique (création + suppression côté backend)
  // ------------------------------------------------------------
  if (fromRealId && !toRealId) {
    try {
      const res = await fetch("http://localhost:3001/rdv/move/medecin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rdvId: fromRealId,
          toDate: toDateStr,
          toHour: toHour,
          medecinId: medecin.id,
        }),
      });

      if (!res.ok) {
        alert("Impossible de déplacer le rendez-vous.");
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur lors du déplacement du rendez-vous.");
    }
    return;
  }

  // ------------------------------------------------------------
  // 3) Case vide → RDV réel
  // 👉 on matérialise la case source, puis SWAP
  // ------------------------------------------------------------
  if (!fromRealId && toRealId) {
    try {
      const createRes = await fetch("http://localhost:3001/rdv/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medecinId: medecin.id,
          date: fromDate,
          heure: fromHour,
          typeSlot: "LIBRE",
        }),
      });

      if (!createRes.ok) {
        alert("Impossible de créer un créneau pour effectuer l'échange.");
        return;
      }

      const createData = await createRes.json();
      const newId: number | undefined = createData?.rdv?.id;

      if (!newId) {
        alert("Erreur interne lors de la création du créneau.");
        return;
      }

      const swapRes = await fetch("http://localhost:3001/rdv/swap/medecin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstId: newId,
          secondId: toRealId,
        }),
      });

      if (!swapRes.ok) {
        alert("Impossible d'échanger ces rendez-vous.");
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur lors de l'échange du rendez-vous.");
    }
    return;
  }

  // ------------------------------------------------------------
  // 4) Case vide → case vide
  // 👉 on matérialise puis on déplace
  // ------------------------------------------------------------
  if (!fromRealId && !toRealId) {
    try {
      const createRes = await fetch("http://localhost:3001/rdv/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medecinId: medecin.id,
          date: fromDate,
          heure: fromHour,
          typeSlot: "LIBRE",
        }),
      });

      if (!createRes.ok) {
        alert("Impossible de créer un créneau pour le déplacement.");
        return;
      }

      const createData = await createRes.json();
      const newId: number | undefined = createData?.rdv?.id;

      if (!newId) {
        alert("Erreur interne lors de la création du créneau.");
        return;
      }

      const updateRes = await fetch(`http://localhost:3001/rdv/${newId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: toDateStr,
          heure: toHour,
          medecinId: medecin.id,
        }),
      });

      if (!updateRes.ok) {
        alert("Impossible de déplacer le créneau libre.");
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur lors du déplacement du créneau.");
    }
  }
};



  /* -------------------------------------------------------
     RENDER
  ---------------------------------------------------------*/
return (
  <div className="flex bg-slate-950 text-white h-screen overflow-hidden">
    {/* SIDEBAR STICKY */}
    <div className="sticky top-0 h-screen">
      <Sidebar />
    </div>

    <div className="flex-1 max-w-7xl mx-auto flex flex-col overflow-hidden">
      {/* HEADER STICKY */}
      <div className="shrink-0 p-8 pb-4 bg-slate-950">
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
      </div>

      {/* PLANNING */}
      <div className="flex-1 px-8 pb-8 overflow-hidden">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg h-full flex flex-col">
          {/* NAVIGATION STICKY */}
          <div className="sticky top-0 z-30 bg-slate-900 p-5 pb-2">
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

                  <button
                    className="underline text-emerald-400 cursor-pointer"
                    onClick={() => openHorairesDrawer("day", selectedDate)}
                  >
                    {formatDate(selectedDate)}
                  </button>

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

                  <button
                    className="underline text-emerald-400 cursor-pointer"
                    onClick={() => openHorairesDrawer("week", weekStart)}
                  >
                    Semaine du {toISODate(weekStart)}
                  </button>

                  <button
                    onClick={goNextWeek}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                  >
                    ▶
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* CONTENU SCROLLABLE */}
          <div className="flex-1 overflow-auto px-5 pb-5">
            {/* Loaders */}
            {loading && <p>Chargement...</p>}
            {error && !loading && <p className="text-red-400">{error}</p>}
            {!horaires && !loading && <p>Aucun horaire chargé.</p>}

            {/* VUE JOUR */}
            {viewMode === "day" &&
              !loading &&
              !error &&
              horaires &&
              (() => {
                const dateStr = toISODate(selectedDate);

                const hasAnyContent = hours.some((hour) => {
                  const rdv = getCellRdv(dateStr, hour);
                  const inHoraires = isWithinHoraires(selectedDate, hour);
                  return !!rdv || inHoraires;
                });

                if (!hasAnyContent) return <p>Aucun créneau aujourd’hui.</p>;

                return (
                  <div className="space-y-2">
                    {hours
                      .filter((h) => h !== "07:00")
                      .map((hour) => {
                        const rdv = getCellRdv(dateStr, hour);
                        const inHoraires = isWithinHoraires(selectedDate, hour);
                        const visual = computeSlotVisual(rdv, inHoraires);
                        const draggable = !!rdv || inHoraires;

                        return (
                          <div
                            key={hour}
                            className={`border px-4 py-3 rounded-xl cursor-pointer hover:brightness-110 transition ${visual.className}`}
                            onClick={() =>
                              openSlotModal(
                                dateStr,
                                hour,
                                "click",
                                rdv?.id ?? null,
                                rdv?.patient?.id ?? null,
                                rdv?.typeConsultation ?? null
                              )
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropMedecin(dateStr, hour)}
                          >
                            <div
                              draggable={draggable}
                              onDragStart={(e) => {
                                if (!draggable) return;
                                makeDragImageInvisible(e);
                                setDragData({
                                  rdvId: rdv?.id ?? null,
                                  fromDate: dateStr,
                                  fromHour: hour,
                                  fromIsVirtual: !rdv,
                                });
                              }}
                            >
                              <p className="font-semibold">
                                {hour}
                                {visual.label && ` — ${visual.label}`}
                              </p>

                              {visual.showMotif && rdv?.motif && (
                                <p className="text-xs mt-1 italic">
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

            {/* VUE SEMAINE */}
            {viewMode === "week" && !loading && !error && horaires && (
              <div className="min-w-[900px]">
                {/* JOURS + DATES STICKY */}
                <div className="sticky top-0 z-20 bg-slate-900 pb-2">
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] text-center text-xs">
                    <div></div>
                    {daysOfWeek.map((d) => (
                      <div
                        key={d.toISOString()}
                        className="text-slate-300 cursor-pointer hover:text-emerald-400"
                        onClick={() => openHorairesDrawer("day", d)}
                      >
                        <div className="font-semibold text-sm underline">
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
                </div>

                {/* GRID */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] text-[11px]">
                  {hours
                    .filter((h) => h !== "07:00")
                    .map((hour) => (
                      <Fragment key={hour}>
                        <div className="h-10 flex items-center justify-center text-slate-400 border-t border-slate-800">
                          {hour}
                        </div>

                        {daysOfWeek.map((d) => {
                          const dateStr = toISODate(d);
                          const rdv = getCellRdv(dateStr, hour);
                          const inHoraires = isWithinHoraires(d, hour);
                          const visual = computeSlotVisual(rdv, inHoraires);
                          const draggable = !!rdv || inHoraires;

                          return (
                            <div
                              key={dateStr + hour}
                              className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer"
                              onClick={() =>
                                openSlotModal(
                                  dateStr,
                                  hour,
                                  "click",
                                  rdv?.id ?? null,
                                  rdv?.patient?.id ?? null,
                                  rdv?.typeConsultation ?? null
                                )
                              }
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => handleDropMedecin(dateStr, hour)}
                            >
                              {rdv ? (
                                <div
                                  className={`h-full rounded-lg px-2 flex flex-col justify-center ${visual.className}`}
                                  draggable={draggable}
                                  onDragStart={(e) => {
                                    if (!draggable) return;
                                    makeDragImageInvisible(e);
                                    setDragData({
                                      rdvId: rdv.id,
                                      fromDate: dateStr,
                                      fromHour: hour,
                                      fromIsVirtual: false,
                                    });
                                  }}
                                >
                                  <span className="font-semibold truncate">
                                    {visual.label}
                                  </span>
                                  {visual.showMotif && rdv.motif && (
                                    <span className="text-[10px] italic truncate">
                                      {rdv.motif}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className={`h-full rounded-lg flex items-center justify-center ${
                                    inHoraires
                                      ? "bg-fuchsia-600 border border-fuchsia-400 text-white font-semibold"
                                      : "bg-slate-950 border border-slate-900"
                                  }`}
                                  draggable={draggable}
                                  onDragStart={(e) => {
                                    if (!draggable || !inHoraires) return;
                                    makeDragImageInvisible(e);
                                    setDragData({
                                      rdvId: null,
                                      fromDate: dateStr,
                                      fromHour: hour,
                                      fromIsVirtual: true,
                                    });
                                  }}
                                >
                                  {inHoraires ? "Libre" : ""}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* MODALE RDV */}
    <AddSlotModal
      open={modal.open}
      date={modal.date}
      heure={modal.heure}
      mode={modal.mode}
      rdvId={modal.rdvId ?? undefined}
      initialPatientId={modal.initialPatientId ?? undefined}
      initialTypeConsultation={modal.initialTypeConsultation ?? undefined}
      medecinId={medecin?.id}
      onClose={(refresh) => {
        setModal({
          open: false,
          date: "",
          heure: "",
          mode: "dayButton",
          rdvId: null,
          initialPatientId: null,
          initialTypeConsultation: null,
        });
        if (refresh) fetchPlanning();
      }}
    />

    {drawerOpen && (
      <ScheduleDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          fetchHoraires();
          fetchPlanning();
        }}
        medecinId={medecin?.id}
        initialHoraires={horaires}
        mode={drawerMode}
        selectedDay={toISODate(drawerDate)}
      />
    )}
  </div>
);

}
