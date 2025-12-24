"use client";

import { useEffect, useState, Fragment, useRef } from "react";
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

  // ✅ peut exister côté back (patientIdentity Json)
  patientIdentity?: {
    nom?: string;
    prenom?: string;
    dateNaissance?: string;
    source?: "CSV" | "HORS";
  } | null;
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

  /* ✅ SCROLL PRESERVE (planning container) */
  const planningScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  // Filet de sécurité pour restore post-render
  const pendingRestoreRef = useRef<boolean>(false);

  const saveScrollPosition = () => {
    if (planningScrollRef.current) {
      lastScrollTopRef.current = planningScrollRef.current.scrollTop;
    }
  };

  /**
   * ✅ Restore robuste :
   * - double requestAnimationFrame (DOM + layout + paint)
   * - + micro-timeout pour couvrir setLoading/StrictMode/rerender tardif
   */
  const restoreScrollPositionRobust = () => {
    pendingRestoreRef.current = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (planningScrollRef.current) {
          planningScrollRef.current.scrollTop = lastScrollTopRef.current;
        }

        setTimeout(() => {
          if (planningScrollRef.current) {
            planningScrollRef.current.scrollTop = lastScrollTopRef.current;
          }
          pendingRestoreRef.current = false;
        }, 0);
      });
    });
  };

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

  /* -------------------------------------------------------
     🔥 UNIFICATION AFFICHAGE DES CRENEAUX (RÉEL UNIQUEMENT)
  ---------------------------------------------------------*/
  const computeSlotVisual = (rdv: Rdv | undefined) => {
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
        rdv?.patient?.nom || rdv?.proche?.nom || rdv?.patientIdentity?.nom || "";

      const identite = prenom || nom ? `${prenom} ${nom}`.trim() : "RDV";

      const consultation =
        rdv?.typeConsultation === "VISIO" ? "Visio" : "Cabinet";

      return {
        label: `${identite} — ${consultation}`,
        className:
          "bg-emerald-600/20 border border-emerald-500/60 text-emerald-100",
        showMotif: true,
      };
    }

    if (slotType === "libre") {
      return {
        label: "Libre",
        className: "bg-fuchsia-600 border border-fuchsia-400 text-white",
        showMotif: false,
      };
    }

    return {
      label: "",
      className: "bg-slate-900/40 border border-slate-700 text-slate-500",
      showMotif: false,
    };
  };

  /* -------------------------------------------------------
     FETCH HORAIRES (uniquement pour ScheduleDrawer)
  ---------------------------------------------------------*/
  const fetchHoraires = async () => {
    if (!medecin) return;

    try {
      const res = await fetch(`http://localhost:3001/medecin/${medecin.id}`);
      const data = await res.json();

      const parsed =
        typeof data.horaires === "string"
          ? JSON.parse(data.horaires)
          : data.horaires;

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
        `http://localhost:3001/rdv/medecin/${
          medecin.id
        }?start=${encodeURIComponent(toLocalISOString(start))}&end=${encodeURIComponent(
          toLocalISOString(end)
        )}`
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

  /**
   * ✅ LA fonction unique à utiliser quand tu veux refresh sans remonter en haut
   * (modale actions, swap/move, drawer close, etc.)
   */
  const refreshPlanningPreserveScroll = async () => {
    saveScrollPosition();
    await fetchPlanning();
    restoreScrollPositionRobust();
  };

  useEffect(() => {
    if (medecin) fetchPlanning();
  }, [medecin, selectedDate, viewMode]);

  // ✅ Filet de sécurité : si un restore est pending, on le refait quand loading retombe
  useEffect(() => {
    if (!loading && pendingRestoreRef.current) {
      restoreScrollPositionRobust();
    }
  }, [loading]);

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
    // ✅ capture au moment du clic sur la case
    saveScrollPosition();

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

    // ✅ capture juste avant de lancer swap/move (c’est ce que tu veux)
    saveScrollPosition();

    const { fromDate, fromHour } = dragData;
    setDragData(null);

    if (fromDate === toDateStr && fromHour === toHour) {
      restoreScrollPositionRobust();
      return;
    }

    const fromRdv = getCellRdv(fromDate, fromHour);
    const toRdv = getCellRdv(toDateStr, toHour);

    const fromRealId = fromRdv?.id ?? null;
    const toRealId = toRdv?.id ?? null;

    if (!fromRealId) {
      restoreScrollPositionRobust();
      return;
    }

    // 1) SWAP
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
          restoreScrollPositionRobust();
          return;
        }

        await refreshPlanningPreserveScroll();
      } catch {
        alert("Erreur serveur lors de l'échange des rendez-vous.");
        restoreScrollPositionRobust();
      }
      return;
    }

    // 2) MOVE
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
          restoreScrollPositionRobust();
          return;
        }

        await refreshPlanningPreserveScroll();
      } catch {
        alert("Erreur serveur lors du déplacement du rendez-vous.");
        restoreScrollPositionRobust();
      }
      return;
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
            <div
              ref={planningScrollRef}
              className="flex-1 overflow-auto px-5 pb-5"
            >
              {/* Loaders */}
              {loading && <p>Chargement...</p>}
              {error && !loading && <p className="text-red-400">{error}</p>}

              {/* VUE JOUR */}
              {viewMode === "day" &&
                !loading &&
                !error &&
                (() => {
                  const dateStr = toISODate(selectedDate);

                  const hasAnyContent = hours.some((hour) => {
                    const rdv = getCellRdv(dateStr, hour);
                    return !!rdv;
                  });

                  if (!hasAnyContent) return <p>Aucun créneau aujourd’hui.</p>;

                  return (
                    <div className="space-y-2">
                      {hours
                        .filter((h) => h !== "07:00")
                        .map((hour) => {
                          const rdv = getCellRdv(dateStr, hour);
                          const visual = computeSlotVisual(rdv);
                          const draggable = !!rdv;

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
                                    fromIsVirtual: false,
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
              {viewMode === "week" && !loading && !error && (
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
                            {d.toLocaleDateString("fr-FR", {
                              weekday: "short",
                            })}
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
                            const visual = computeSlotVisual(rdv);
                            const draggable = !!rdv;

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
                                  <div className="h-full rounded-lg flex items-center justify-center bg-slate-950 border border-slate-900">
                                    {/* vide */}
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
            {/* MODALE RDV */}
      <AddSlotModal
        open={modal.open}
        date={modal.date}
        heure={modal.heure}
        mode={modal.mode}
        rdvId={modal.rdvId ?? undefined}
        medecinId={medecin?.id}
        // ✅ AJOUT : contexte slot pour UI + cohérence
        typeSlot={
          (() => {
            const rdv = getCellRdv(modal.date, modal.heure);
            const t = (rdv?.typeSlot || "").toUpperCase();
            return (t as any) || undefined;
          })()
        }
        formulaireDemande={
          (() => {
            const rdv = getCellRdv(modal.date, modal.heure) as any;
            return rdv?.formulaireDemande === true;
          })()
        }
        onClose={(refresh) => {
          saveScrollPosition();

          setModal({
            open: false,
            date: "",
            heure: "",
            mode: "dayButton",
            rdvId: null,
            initialPatientId: null,
            initialTypeConsultation: null,
          });

          if (refresh) {
            refreshPlanningPreserveScroll();
          } else {
            restoreScrollPositionRobust();
          }
        }}
      />


      {drawerOpen && (
        <ScheduleDrawer
          open={drawerOpen}
          onClose={() => {
            setDrawerOpen(false);

            // safe: évite un saut si le drawer déclenche des rerenders
            refreshPlanningPreserveScroll();
            fetchHoraires();
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
