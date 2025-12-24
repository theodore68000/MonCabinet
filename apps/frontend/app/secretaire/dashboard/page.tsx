// ============================================================================
//  apps/frontend/app/secretaire/dashboard/page.tsx
// ============================================================================
//  DASHBOARD SECRÉTAIRE — VERSION FINALE ALIGNÉE DASHBOARD MÉDECIN
//
//  FIX DEMANDÉS (DEC 2025) :
//  1) "Je ne vois pas les créneaux sur la vue médecin"  => AFFICHER les slots virtuels
//     (dans les horaires) comme des créneaux LIBRES (mêmes couleurs / règles).
//  2) "Je veux que tu me dégage la vue jour de la vue médecin" => SUPPRIMER la vue "day"
//     côté médecin : quand on est sur un médecin, on est toujours en "week".
//
//  Conservé :
//  - Scroll UNIQUEMENT sur le planning (pas la page entière)
//  - Swap / Move (drag & drop) ne remonte JAMAIS en haut
//  - AddSlotModal : fermeture (croix) OU enregistrement ne remonte JAMAIS
//  - Exactement les mêmes couleurs / règles d'affichage de créneaux
//
//  Notes d'implémentation :
//  - On reprend strictement les patterns du dashboard médecin :
//    - planningScrollRef + lastScrollTopRef
//    - saveScrollPosition()
//    - restoreScrollPositionRobust() (double rAF + micro-timeout)
//    - refreshPlanningPreserveScroll() et refreshCabinetPreserveScroll()
//    - appel systématique de saveScrollPosition AVANT toute action qui refresh
//  - Le layout utilise : h-screen + overflow-hidden (la page ne scrolle pas)
//    et un container planning en overflow-y-auto.
//
//  IMPORTANT :
//  - Fichier volontairement verbeux.
//  - Autonome et remplace l'ancien dashboard secrétaire.
//
//  FIX SWAP (DEC 2025) :
//  - En vue médecin (week), une secrétaire doit appeler le back "médecin"
//    => PATCH /rdv/swap/medecin-view (et non /rdv/swap/secretaire)
//  - En vue cabinet day, on garde /rdv/swap/secretaire (inter-médecins + règles cabinet)
// ============================================================================

// ============================================================================
//  apps/frontend/app/secretaire/dashboard/page.tsx
// ============================================================================
//  DASHBOARD SECRÉTAIRE — ALIGNÉ DASHBOARD MÉDECIN (FULL LOGIQUE, SANS RENDER)
//
//  FIX PRINCIPAL : VUE MÉDECIN VIDE
//  - Les horaires existent mais les clés / formats ne matchent pas isWithinHoraires()
//  - On normalise horaires côté front (jours + formats) et on tolère espaces.
//  - fetchHoraires() appelle /rdv/medecin/:id/planning-meta (route secrétaire dédiée)
//
//  NOTE : render JSX SUPPRIMÉ volontairement (tu réutilises ton render).
// ============================================================================
// ============================================================================
//  apps/frontend/app/secretaire/dashboard/page.tsx
// ============================================================================
//  DASHBOARD SECRÉTAIRE — VERSION ALIGNÉE DASHBOARD MÉDECIN (OPTION A)
//
//  OBJECTIF (Option A) :
//  - Vue médecin secrétaire = EXACTEMENT la vue médecin
//    => uniquement rdvs réels, pas de slots virtuels, pas d’horaires
//    => pas de vue "jour" médecin : médecin = toujours "week"
//  - Vue cabinet (cabinetDay) inchangée (elle marche déjà)
//  - Drag&Drop swap/move : secrétaire doit pouvoir faire comme médecin
//    - swap en vue médecin : PATCH /rdv/swap/medecin-view
//    - swap en vue cabinet : PATCH /rdv/swap/secretaire
//  - Scroll du planning préservé (ne remonte jamais)
//  - AddSlotModal close/refresh ne remonte jamais
//
//  NOTE IMPORTANTE : RENDER JSX SUPPRIMÉ volontairement (tu réutilises ton JSX).
// ============================================================================

"use client";

import React, { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useRouter } from "next/navigation";

import SidebarSecretaire from "./components/Sidebar";
import Tooltip from "./components/Tooltip";

// On réutilise EXACTEMENT les mêmes composants que médecin
import AddSlotModal, { ModalMode } from "../../medecin/dashboard/components/AddSlotModal";
import ScheduleDrawer from "../../medecin/dashboard/components/ScheduleDrawer";

// ============================================================================
//  TYPES
// ============================================================================

type SecretaireSession = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  cabinetId: number;
  telephone?: string | null;
  cabinet?: { id: number; nom: string } | null;
};

type MedecinLite = {
  id: number;
  nom: string;
  prenom: string;
};

type Rdv = {
  id: number;
  date: string; // ISO
  heure: string; // "HH:MM"
  motif?: string | null;
  statut?: string | null;
  typeConsultation?: string | null; // "VISIO" | "PRESENTIEL" (ou null)
  typeSlot?: string | null; // "LIBRE" | "PRIS" | "BLOQUE" | "HORS"

  // patient / proche (comme médecin)
  patient?: {
    id: number;
    nom: string;
    prenom: string;
    notePatient?: string | null;
  } | null;

  proche?: {
    id: number;
    nom: string;
    prenom: string;
  } | null;

  // patientIdentity (JSON back) peut exister
  patientIdentity?: {
    nom?: string;
    prenom?: string;
    dateNaissance?: string;
    source?: "CSV" | "HORS";
  } | null;
};

// NOTE : pas de vue "day" médecin.
// - "cabinetDay" : journée cabinet multi-médecins
// - "week"       : semaine d'un médecin (unique mode médecin)
type ViewMode = "week" | "cabinetDay";

// ---------------------------------------------------------------------------
//  Types pour la vue cabinet jour
// ---------------------------------------------------------------------------

type CabinetSlot = {
  heure: string;
  isVirtual: boolean;
  typeSlot: string; // "LIBRE"|"PRIS"|"BLOQUE"|"HORS"

  patient?: {
    id: number;
    nom: string;
    prenom: string;
    notePatient?: string | null;
  } | null;

  proche?: {
    id: number;
    nom: string;
    prenom: string;
  } | null;

  motif?: string | null;
  rdvId: number | null;
  typeConsultation?: string | null;

  patientIdentity?: {
    nom?: string;
    prenom?: string;
  } | null;
};

type CabinetMedecinDay = {
  id: number;
  nom: string;
  prenom: string;
  horaires: any;
  slots: CabinetSlot[];
};

type CabinetPlanningDay = {
  date: string; // YYYY-MM-DD
  medecins: CabinetMedecinDay[];
};

// ============================================================================
//  CONSTANTES / HELPERS
// ============================================================================

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // lundi
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const makeDragImageInvisible = (e: any) => {
  if (e?.dataTransfer) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    e.dataTransfer.setDragImage(img, 0, 0);
  }
};

// ============================================================================
//  VISUELS (identiques médecin)
// ============================================================================

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
      className: "bg-red-600/20 border border-red-500/60 text-white font-semibold",
      showMotif: false,
    };
  }

  if (slotType === "pris") {
    const prenom =
      rdv?.patient?.prenom || rdv?.proche?.prenom || rdv?.patientIdentity?.prenom || "";
    const nom = rdv?.patient?.nom || rdv?.proche?.nom || rdv?.patientIdentity?.nom || "";
    const identite = prenom || nom ? `${prenom} ${nom}`.trim() : "RDV";
    const consultation = rdv?.typeConsultation === "VISIO" ? "Visio" : "Cabinet";

    return {
      label: `${identite} — ${consultation}`,
      className: "bg-emerald-600/20 border border-emerald-500/60 text-emerald-100",
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

const computeCabinetSlotVisual = (slot: CabinetSlot | undefined) => {
  if (!slot) return computeSlotVisual(undefined);

  const fake: Rdv = {
    id: slot.rdvId ?? -1,
    date: "",
    heure: slot.heure,
    motif: slot.motif ?? null,
    typeSlot: (slot.typeSlot || "HORS").toUpperCase(),
    typeConsultation: slot.typeConsultation ?? null,
    patient: slot.patient ? { id: slot.patient.id, nom: slot.patient.nom, prenom: slot.patient.prenom } : null,
    proche: slot.proche ? { id: slot.proche.id, nom: slot.proche.nom, prenom: slot.proche.prenom } : null,
    patientIdentity: slot.patientIdentity ?? null,
  };

  return computeSlotVisual(fake);
};

// ============================================================================
//  MAIN COMPONENT
// ============================================================================

export default function SecretaireDashboard() {
  const router = useRouter();

  // ==========================================================================
  //  SCROLL PRESERVE
  // ==========================================================================

  const planningScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const pendingRestoreRef = useRef<boolean>(false);

  const saveScrollPosition = () => {
    if (planningScrollRef.current) lastScrollTopRef.current = planningScrollRef.current.scrollTop;
  };

  const restoreScrollPositionRobust = () => {
    pendingRestoreRef.current = true;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (planningScrollRef.current) planningScrollRef.current.scrollTop = lastScrollTopRef.current;

        setTimeout(() => {
          if (planningScrollRef.current) planningScrollRef.current.scrollTop = lastScrollTopRef.current;
          pendingRestoreRef.current = false;
        }, 0);
      });
    });
  };

  // ==========================================================================
  //  STATE
  // ==========================================================================

  const [secretaire, setSecretaire] = useState<SecretaireSession | null>(null);

  const [medecins, setMedecins] = useState<MedecinLite[]>([]);
  const [selectedMedecinId, setSelectedMedecinId] = useState<number | null>(null);

  const [rdvs, setRdvs] = useState<Rdv[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [viewMode, setViewMode] = useState<ViewMode>("cabinetDay");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [cabinetPlanning, setCabinetPlanning] = useState<CabinetPlanningDay | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"day" | "week">("day");
  const [drawerDate, setDrawerDate] = useState<Date>(new Date());

  // ==========================================================================
  //  MODAL RDV
  // ==========================================================================

  const [modal, setModal] = useState<{
    open: boolean;
    date: string;
    heure: string;
    mode: ModalMode;
    rdvId?: number | null;
    initialPatientId?: number | null;
    initialTypeConsultation?: string | null;
    medecinId?: number | null;
  }>({
    open: false,
    date: "",
    heure: "",
    mode: "dayButton",
    rdvId: null,
    initialPatientId: null,
    initialTypeConsultation: null,
    medecinId: null,
  });

  // ==========================================================================
  //  DRAG & DROP
  // ==========================================================================

  const [dragData, setDragData] = useState<{
    rdvId: number | null;
    fromMedecinId: number;
    fromDate: string;
    fromHour: string;
    fromIsVirtual: boolean;
  } | null>(null);

  // ==========================================================================
  //  SESSION (localStorage)
  // ==========================================================================

  useEffect(() => {
    const saved = localStorage.getItem("secretaireSession");
    if (!saved) {
      router.push("/secretaire/login");
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setSecretaire(parsed);
    } catch {
      localStorage.removeItem("secretaireSession");
      router.push("/secretaire/login");
    }
  }, [router]);

  // ==========================================================================
  //  HYDRATE PROFIL COMPLET (facultatif mais on garde ton flow)
  // ==========================================================================

  useEffect(() => {
    if (!secretaire?.id) return;

    const fetchSecretaireProfile = async () => {
      try {
        const res = await fetch(`http://localhost:3001/secretaire/${secretaire.id}`);
        const data = await res.json().catch(() => null);

        if (res.ok && data?.id) {
          setSecretaire((prev) => ({ ...(prev as any), ...(data as any) }));

          try {
            const existing = localStorage.getItem("secretaireSession");
            const parsedExisting = existing ? JSON.parse(existing) : {};
            localStorage.setItem("secretaireSession", JSON.stringify({ ...parsedExisting, ...data }));
          } catch {
            // silence
          }
        }
      } catch {
        // silence
      }
    };

    fetchSecretaireProfile();
  }, [secretaire?.id]);

  // ==========================================================================
  //  FETCH MÉDECINS (endpoint secrétaire + fallback cabinet)
  // ==========================================================================

  useEffect(() => {
    if (!secretaire) return;

    const fetchMedecins = async () => {
      // 1) endpoint direct secrétaire
      if (secretaire.id) {
        try {
          const res = await fetch(`http://localhost:3001/secretaire/${secretaire.id}/medecins`);
          const data = await res.json().catch(() => null);

          if (res.ok && data?.success && Array.isArray(data.medecins)) {
            if (data.medecins.length) {
              setMedecins(data.medecins);

              // sélection par défaut + FORÇAGE mode "week" si on choisit un médecin
              setSelectedMedecinId((prev) => prev ?? data.medecins[0].id);
              // on ne force pas automatiquement viewMode ici (tu gères via ton select UI)
            } else {
              setMedecins([]);
              setSelectedMedecinId(null);
            }
            return;
          }
        } catch {
          // fallback
        }
      }

      // 2) fallback via cabinet
      if (!secretaire.cabinetId) return;

      try {
        const res = await fetch(`http://localhost:3001/cabinet/${secretaire.cabinetId}`);
        const data = await res.json().catch(() => null);

        if (data?.medecins?.length) {
          setMedecins(data.medecins);
          setSelectedMedecinId((prev) => prev ?? data.medecins[0].id);
        }
      } catch {
        // silence
      }
    };

    fetchMedecins();
  }, [secretaire]);

  // ==========================================================================
  //  HELPERS DATE / TIME
  // ==========================================================================

  const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);

  const daysOfWeek = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const hours = useMemo(() => {
    return Array.from({ length: (23 - 7) * 4 }, (_, i) => {
      const min = 7 * 60 + i * 15;
      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      return `${hh}:${mm}`;
    });
  }, []);

  // RDV lookup
  const getCellRdv = (dateStr: string, heure: string) =>
    rdvs.find((r) => {
      const d = new Date(r.date);
      const key = toISODate(d);
      return key === dateStr && r.heure === heure;
    });

  // ==========================================================================
  //  FETCH PLANNING médecin (week) — ALIGNÉ MÉDECIN
  // ==========================================================================

  const fetchPlanning = async () => {
    // IMPORTANT Option A:
    // - en mode cabinetDay => on ne charge pas le planning médecin
    if (!selectedMedecinId || viewMode === "cabinetDay") return;

    setLoading(true);
    setError("");

    const start = getWeekStart(selectedDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    try {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      const res = await fetch(`http://localhost:3001/rdv/medecin/${selectedMedecinId}?${params}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        setError(data?.message || "Erreur chargement planning.");
        setRdvs([]);
        return;
      }

      setRdvs(data?.rdvs || data || []);
    } catch {
      setError("Erreur serveur.");
      setRdvs([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshPlanningPreserveScroll = async () => {
    saveScrollPosition();
    await fetchPlanning();
    restoreScrollPositionRobust();
  };

  useEffect(() => {
    if (viewMode === "cabinetDay") return;
    fetchPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMedecinId, selectedDate, viewMode]);

  useEffect(() => {
    if (!loading && pendingRestoreRef.current) restoreScrollPositionRobust();
  }, [loading]);

  // ==========================================================================
  //  FETCH PLANNING CABINET (cabinetDay) — INCHANGÉ
  // ==========================================================================

  const fetchCabinetPlanning = async () => {
    if (!secretaire?.cabinetId) return;

    setLoading(true);
    setError("");
    setCabinetPlanning(null);

    const dateStr = toISODate(selectedDate);

    try {
      const res = await fetch(`http://localhost:3001/rdv/cabinet/${secretaire.cabinetId}/day?date=${dateStr}`);
      const data = await res.json().catch(() => null);

      if (!res.ok || data?.success === false) {
        setError(data?.message || "Erreur chargement planning cabinet.");
        setCabinetPlanning(null);
        return;
      }

      const normalizedMedecins: CabinetMedecinDay[] = (data?.medecins || []).map((m: any) => ({
        ...m,
        slots: (m?.slots || []).map((s: any) => ({
          ...s,
          rdvId: s?.rdvId ?? null,
          typeSlot: (s?.typeSlot || "HORS").toUpperCase(),
        })),
      }));

      setCabinetPlanning({
        date: data?.date,
        medecins: normalizedMedecins,
      });
    } catch {
      setError("Erreur serveur (planning cabinet).");
      setCabinetPlanning(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshCabinetPreserveScroll = async () => {
    saveScrollPosition();
    await fetchCabinetPlanning();
    restoreScrollPositionRobust();
  };

  useEffect(() => {
    if (viewMode !== "cabinetDay") return;
    fetchCabinetPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate, secretaire?.cabinetId]);

  // ==========================================================================
  //  NAVIGATION
  // ==========================================================================

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

  // ==========================================================================
  //  OPEN MODAL
  // ==========================================================================

  const openSlotModal = (
    date: string,
    heure: string,
    mode: ModalMode,
    rdvId?: number | null,
    initialPatientId?: number | null,
    initialTypeConsultation?: string | null,
    medecinIdOverride?: number | null
  ) => {
    saveScrollPosition();

    setModal({
      open: true,
      date,
      heure,
      mode,
      rdvId: rdvId ?? null,
      initialPatientId: initialPatientId ?? null,
      initialTypeConsultation: initialTypeConsultation ?? null,
      medecinId: medecinIdOverride ?? selectedMedecinId ?? null,
    });
  };

  // ==========================================================================
  //  DROP — VUE MÉDECIN (week) — ALIGNÉ MÉDECIN (swap / move / create-slot)
  //
  //  ✅ FIX : SWAP autorisé dès que fromRealId && toRealId (peu importe typeSlot)
  // ==========================================================================

 const handleDropMedecin = async (toDateStr: string, toHour: string) => {
  if (!dragData || !selectedMedecinId) return;

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

  // ✅ FIX : endpoint EXISTANT
  const SWAP_ENDPOINT_WEEK = "http://localhost:3001/rdv/swap/medecin";

  // 1) SWAP (rdv -> rdv)
  if (fromRealId && toRealId) {
    try {
      const res = await fetch(SWAP_ENDPOINT_WEEK, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstId: fromRealId, secondId: toRealId }),
      });

      if (!res.ok) {
        alert("Impossible d'échanger les rendez-vous.");
        restoreScrollPositionRobust();
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur lors de l'échange.");
    } finally {
      restoreScrollPositionRobust();
    }
    return;
  }

  // 2) MOVE (rdv -> vide)
  if (fromRealId && !toRealId) {
    try {
      const res = await fetch("http://localhost:3001/rdv/move/secretaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rdvId: fromRealId,
          toDate: toDateStr,
          toHour,
          toMedecinId: selectedMedecinId,
        }),
      });

      if (!res.ok) {
        alert("Impossible de déplacer le rendez-vous.");
        restoreScrollPositionRobust();
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur lors du déplacement.");
    } finally {
      restoreScrollPositionRobust();
    }
    return;
  }

  // 3) drag depuis une case vide -> création + swap/move (inchangé)
  if (!fromRealId && toRealId) {
    try {
      const createRes = await fetch("http://localhost:3001/rdv/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medecinId: selectedMedecinId,
          date: fromDate,
          heure: fromHour,
          typeSlot: "LIBRE",
        }),
      });

      if (!createRes.ok) {
        alert("Impossible de créer un créneau.");
        restoreScrollPositionRobust();
        return;
      }

      const created = await createRes.json().catch(() => null);
      const createdId = created?.rdv?.id;
      if (!createdId) {
        restoreScrollPositionRobust();
        return;
      }

      const swapRes = await fetch(SWAP_ENDPOINT_WEEK, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstId: createdId, secondId: toRealId }),
      });

      if (!swapRes.ok) {
        alert("Impossible d'échanger les rendez-vous.");
        restoreScrollPositionRobust();
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur.");
    } finally {
      restoreScrollPositionRobust();
    }
    return;
  }

  if (!fromRealId && !toRealId) {
    try {
      const createRes = await fetch("http://localhost:3001/rdv/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medecinId: selectedMedecinId,
          date: fromDate,
          heure: fromHour,
          typeSlot: "LIBRE",
        }),
      });

      if (!createRes.ok) {
        restoreScrollPositionRobust();
        return;
      }

      const created = await createRes.json().catch(() => null);
      const createdId = created?.rdv?.id;
      if (!createdId) {
        restoreScrollPositionRobust();
        return;
      }

      const moveRes = await fetch("http://localhost:3001/rdv/move/secretaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rdvId: createdId,
          toDate: toDateStr,
          toHour,
          toMedecinId: selectedMedecinId,
        }),
      });

      if (!moveRes.ok) {
        alert("Impossible de déplacer le créneau.");
        restoreScrollPositionRobust();
        return;
      }

      await fetchPlanning();
    } catch {
      alert("Erreur serveur.");
    } finally {
      restoreScrollPositionRobust();
    }
  }
};


  // ==========================================================================
  //  DROP — VUE CABINET DAY
  //
  //  ✅ FIX : SWAP autorisé dès que fromRealId && toRealId (peu importe typeSlot)
  // ==========================================================================
const handleDropCabinet = async (toMedecinId: number, toHour: string) => {

  
  if (!dragData || !cabinetPlanning) return;

  saveScrollPosition();

  const { fromMedecinId, fromHour, fromDate } = dragData;
  setDragData(null);

  const date = cabinetPlanning.date;

  // noop
  if (fromMedecinId === toMedecinId && fromHour === toHour && fromDate === date) {
    restoreScrollPositionRobust();
    return;
  }

  const fromMed = cabinetPlanning.medecins.find(m => m.id === fromMedecinId);
  const toMed   = cabinetPlanning.medecins.find(m => m.id === toMedecinId);

  const fromSlot = fromMed?.slots.find(s => s.heure === fromHour);
  const toSlot   = toMed?.slots.find(s => s.heure === toHour);

  if (!fromSlot || !toSlot) {
    restoreScrollPositionRobust();
    return;
  }

  const parseId = (v: any): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const normalizeTypeSlot = (t: any) => {
    const up = (t ?? "HORS").toString().trim().toUpperCase();
    return ["LIBRE","PRIS","BLOQUE","HORS"].includes(up) ? up : "HORS";
  };

  let fromRealId = parseId(fromSlot.rdvId);
  let toRealId   = parseId(toSlot.rdvId);

  // cible visuellement vide => MOVE


  const ensureRealSlot = async (
    medecinId: number,
    heure: string,
    slot: CabinetSlot
  ): Promise<number | null> => {
    const existing = parseId(slot.rdvId);
    if (existing) return existing;

    try {
      const res = await fetch("http://localhost:3001/rdv/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medecinId,
          date,
          heure,
          typeSlot: normalizeTypeSlot(slot.typeSlot),
        }),
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return parseId(data?.rdv?.id);
    } catch {
      return null;
    }
  };

  // 1) matérialiser la SOURCE si virtuelle
  if (!fromRealId) {
    const created = await ensureRealSlot(fromMedecinId, fromHour, fromSlot);
    if (created) fromRealId = created;
  }
  if (!fromRealId) {
    restoreScrollPositionRobust();
    return;
  }

// 2) MOVE uniquement si la cible N'A PAS de rdvId
if (!toRealId) {
  try {
    await fetch("http://localhost:3001/rdv/move/secretaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rdvId: fromRealId,
        toDate: date,
        toHour,
        toMedecinId,
      }),
    });
  } finally {
    await fetchCabinetPlanning();
    restoreScrollPositionRobust();
  }
  return;
}

// 3) SWAP dès que les DEUX ont un rdvId (y compris HORS)
if (fromRealId && toRealId) {
  try {
await fetch("http://localhost:3001/rdv/swap/medecin", {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    firstId: fromRealId,
    secondId: toRealId,
  }),
});

  } finally {
    await fetchCabinetPlanning();
    restoreScrollPositionRobust();
  }
  return;
}

}


  // ==========================================================================
  //  RENDER JSX (SUPPRIMÉ)
  // ==========================================================================
  // Tu gardes ton UI inchangée (tes ~1000 lignes JSX).
  // Le seul prérequis : continuer à câbler tes cases avec :
  // - onDragStart => setDragData(...) + makeDragImageInvisible(e)
  // - onDragOver  => e.preventDefault()
  // - onDrop      => handleDropMedecin(...) OU handleDropCabinet(...)
  //
  // IMPORTANT : le fix est déjà intégré dans handleDropMedecin / handleDropCabinet :
  // - SWAP si fromRealId && toRealId (quelque soit typeSlot)
  // - MOVE si fromRealId && !toRealId
  // - création slot si on “drag” depuis du vide (comportement historique)

  // NOTE: ta partie JSX commence ici dans ton fichier original avec `const btnBase = ...` puis `return (...)`



  // ==========================================================================
  //  RENDER JSX (SUPPRIMÉ)
  // ==========================================================================
  // Tu conserves ton UI exactement, avec les ajustements Option A :
  //
  // 1) Quand un médecin est choisi : setViewMode("week") (pas de vue jour médecin)
  // 2) Dans la grille week médecin : afficher UNIQUEMENT rdv (getCellRdv) — pas de within/horaires/slots virtuels
  // 3) handleDropMedecin utilise /rdv/swap/medecin-view (déjà dans ce fichier)
  //
  // Pour que ton JSX compile, il doit continuer à utiliser :
  // - planningScrollRef
  // - medecins / selectedMedecinId / viewMode / selectedDate
  // - daysOfWeek / hours
  // - computeSlotVisual / computeCabinetSlotVisual
  // - openSlotModal / handleDropMedecin / handleDropCabinet
  // - dragData / setDragData / makeDragImageInvisible
  // - modal state + AddSlotModal (déjà prêt ci-dessous)


  // ==========================================================================
  //  RENDER
  // ==========================================================================

  // ==========================================================================
  //  RENDER
  // ==========================================================================

  const btnBase = "px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm";

  return (
    <div className="flex bg-slate-950 text-white h-screen overflow-hidden">
      {/* SIDEBAR STICKY */}
      <div className="sticky top-0 h-screen">
        <SidebarSecretaire />
      </div>

      <div className="flex-1 max-w-7xl mx-auto flex flex-col overflow-hidden">
        {/* ============================================================
            HEADER (fixe)
        ============================================================ */}
        <div className="shrink-0 p-8 pb-4 bg-slate-950">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-emerald-400">Dashboard secrétaire</h1>
              <p className="text-slate-400">
                {secretaire?.prenom} {secretaire?.nom}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Select mode : cabinet day ou semaine d'un médecin */}
              <select
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm"
                onChange={(e) => {
                  const val = e.target.value;

                  // 🔑 capture scroll : la navigation ne doit pas faire de jump
                  saveScrollPosition();

                  if (val === "cabinet") {
                    setViewMode("cabinetDay");
                    restoreScrollPositionRobust();
                    return;
                  }

                  if (val.startsWith("medecin-")) {
                    const id = Number(val.replace("medecin-", ""));
                    setSelectedMedecinId(id);

                    // vue médecin => SEMAINE UNIQUEMENT
                    setViewMode("week");

                    restoreScrollPositionRobust();
                    return;
                  }
                }}
                value={
                  viewMode === "cabinetDay"
                    ? "cabinet"
                    : selectedMedecinId
                    ? `medecin-${selectedMedecinId}`
                    : "cabinet"
                }
              >
                <option value="cabinet">🏥 Cabinet — Journée</option>

                {medecins.map((m) => (
                  <option key={m.id} value={`medecin-${m.id}`}>
                    📅 Semaine Dr {m.prenom} {m.nom}
                  </option>
                ))}
              </select>

              {/* Toggle Jour/Semaine supprimé : vue jour dégagée côté médecin */}
              {viewMode !== "cabinetDay" && (
                <div className="flex items-center gap-2">
                  <button className={btnBase + " ring-1 ring-emerald-500"} disabled>
                    Semaine
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================
            BARRE NAV PLANNING (fixe)
        ============================================================ */}
        <div className="px-8 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Planning</h2>
            {selectedMedecinId && viewMode !== "cabinetDay" && (
              <span className="text-slate-400 text-sm">
                Médecin : {medecins.find((m) => m.id === selectedMedecinId)?.prenom}{" "}
                {medecins.find((m) => m.id === selectedMedecinId)?.nom}
              </span>
            )}
          </div>

          {/* Nav date */}
          {viewMode === "week" ? (
            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => {
                  saveScrollPosition();
                  goPrevWeek();
                  restoreScrollPositionRobust();
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                ◀
              </button>

              {/*canEditHoraires ? (
                <button
                  onClick={() => openHorairesDrawer("week", weekStart)}
                  className="underline text-emerald-400 hover:text-emerald-300"
                >
                  Semaine du {toISODate(weekStart)}
                </button>
              ) : (
                <span className="text-emerald-300">Semaine du {toISODate(weekStart)}</span>
              )*/}

              <button
                onClick={() => {
                  saveScrollPosition();
                  goNextWeek();
                  restoreScrollPositionRobust();
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                ▶
              </button>
            </div>
          ) : (
            // cabinetDay
            <div className="flex items-center gap-3 text-sm">
              <button
                onClick={() => {
                  saveScrollPosition();
                  goPrevDay();
                  restoreScrollPositionRobust();
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                ◀
              </button>

              <span className="text-emerald-300">{formatDate(selectedDate)}</span>

              <button
                onClick={() => {
                  saveScrollPosition();
                  goNextDay();
                  restoreScrollPositionRobust();
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                ▶
              </button>
            </div>
          )}
        </div>

        {/* ============================================================
            PLANNING (SCROLL UNIQUEMENT ICI)
        ============================================================ */}
        <div className="flex-1 overflow-hidden">
          <div ref={planningScrollRef} className="h-full overflow-y-auto px-8 py-6">
            {loading && <p className="text-slate-400">Chargement…</p>}
            {error && !loading && <p className="text-red-400">{error}</p>}

{/* ============================================================
    VUE WEEK (médecin) — SANS HORAIRES / SANS VIRTUEL
    => uniquement RDV réels (comme dashboard médecin)
============================================================ */}
{viewMode === "week" && !loading && !error && selectedMedecinId && (
  <div className="min-w-[980px]">
    {/* header jours sticky */}
    <div className="sticky -top-6 z-20 bg-slate-950 pb-2">
      <div className="relative top-0.5 grid grid-cols-[80px_repeat(7,1fr)] text-center text-xs">
        <div></div>
        {daysOfWeek.map((d) => (
          <div
            key={d.toISOString()}
            className="text-slate-300 cursor-pointer hover:text-emerald-400"
            onClick={() => {
              setDrawerMode("day");
              setDrawerDate(d);
              setDrawerOpen(true);
            }}
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

    {/* grid */}
    <div className="grid grid-cols-[80px_repeat(7,1fr)] text-[11px]">
      {hours.map((hour) => (
        <Fragment key={hour}>
          <div className="h-10 flex items-center justify-center text-slate-400 border-t border-slate-800">
            {hour}
          </div>

          {daysOfWeek.map((d) => {
            const dateStr = toISODate(d);
            const rdv = getCellRdv(dateStr, hour);
            const visual = computeSlotVisual(rdv);
            const isDraggable = !!rdv;

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
                    rdv?.typeConsultation ?? null,
                    selectedMedecinId
                  )
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropMedecin(dateStr, hour)}
              >
                {rdv ? (
                  <div
                    className={`h-full rounded-lg px-2 flex flex-col justify-center ${visual.className} cursor-pointer hover:brightness-110 transition`}
                    draggable={isDraggable}
                    onDragStart={(e) => {
                      makeDragImageInvisible(e);
                      setDragData({
                        rdvId: rdv.id,
                        fromMedecinId: selectedMedecinId,
                        fromDate: dateStr,
                        fromHour: hour,
                        fromIsVirtual: false,
                      });
                    }}
                  >
                    <span className="font-semibold truncate">
                      {visual.label}
                    </span>
                    {visual.showMotif && rdv?.motif && (
                      <span className="text-[10px] italic truncate">
                        {rdv.motif}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="h-full rounded-lg flex items-center justify-center bg-slate-950/30 border border-slate-900" />
                )}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  </div>
)}

            {/* ============================================================
                VUE CABINET DAY (Mode 1)
            ============================================================ */}
            {viewMode === "cabinetDay" && !loading && !error && (
              <>
                {!cabinetPlanning ? (
                  <p className="text-slate-400">Aucun planning cabinet.</p>
                ) : (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Cabinet — Journée</h3>
                        <p className="text-slate-400 text-sm">{cabinetPlanning.date}</p>
                      </div>
                      <p className="text-slate-500 text-xs">Drag & Drop : swap / move inter-médecins</p>
                    </div>

                    <div className="p-5">
                      <div className="min-w-[980px]">
                        {/* Header sticky médecins */}
                        <div className="sticky -top-6 z-20 bg-slate-900 pb-2">
                          <div
                            className="relative top-1 grid text-center text-xs"
                            style={{
                              gridTemplateColumns: `80px repeat(${cabinetPlanning.medecins.length}, minmax(170px, 1fr))`,
                            }}
                          >
                            <div></div>
                            {cabinetPlanning.medecins.map((m) => (
                              <div key={m.id} className="text-slate-300">
                                <div className="font-semibold text-sm">
                                  Dr {m.prenom} {m.nom}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Grid */}
                        <div
                          className="grid text-[11px]"
                          style={{
                            gridTemplateColumns: `80px repeat(${cabinetPlanning.medecins.length}, minmax(170px, 1fr))`,
                          }}
                        >
                          {hours.map((hour) => (
                            <Fragment key={hour}>
                              <div className="h-10 flex items-center justify-center text-slate-400 border-t border-slate-800">
                                {hour}
                              </div>

                              {cabinetPlanning.medecins.map((m) => {
                                const slot = m.slots.find((s) => s.heure === hour);
                                const visual = computeCabinetSlotVisual(slot);

                                const isDraggable = !!slot?.rdvId;


                                const handleClick = () => {
                                  openSlotModal(
                                    cabinetPlanning.date,
                                    hour,
                                    "click",
                                    slot?.rdvId ?? null,
                                    slot?.patient?.id ?? null,
                                    slot?.typeConsultation ?? null,
                                    m.id
                                  );
                                };

                                return (
                                  <div
                                    key={`${m.id}-${hour}`}
                                    className="h-10 border-t border-slate-800 px-1 py-1"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleDropCabinet(m.id, hour)}
                                  >
                                    <Tooltip text={slot?.patient?.notePatient || slot?.motif || ""}>
                                      <div
                                        className={`h-full rounded-lg px-2 flex flex-col justify-center ${visual.className} ${
                                          slot ? "cursor-pointer hover:brightness-110 transition" : ""
                                        }`}
                                        draggable={isDraggable}
                                        onDragStart={(e) => {
                                          if (!slot) return;
                                          makeDragImageInvisible(e);
                                          setDragData({
                                            rdvId: slot.rdvId ?? null,
                                            fromMedecinId: m.id,
                                            fromDate: cabinetPlanning.date,
                                            fromHour: hour,
                                            fromIsVirtual: slot.isVirtual || !slot.rdvId,
                                          });
                                        }}
                                        onClick={handleClick}
                                      >
                                        {visual.label && <span className="font-semibold truncate">{visual.label}</span>}
                                        {visual.showMotif && slot?.motif && (
                                          <span className="text-[10px] italic truncate">{slot.motif}</span>
                                        )}
                                      </div>
                                    </Tooltip>
                                  </div>
                                );
                              })}
                            </Fragment>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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
        medecinId={modal.medecinId ?? selectedMedecinId ?? undefined}
        onClose={(refresh: boolean) => {
          setModal({
            open: false,
            date: "",
            heure: "",
            mode: "dayButton",
            rdvId: null,
            initialPatientId: null,
            initialTypeConsultation: null,
            medecinId: null,
          });

          if (refresh) {
            if (viewMode === "cabinetDay") {
              fetchCabinetPlanning();
            } else {
              fetchPlanning();
            }
          }
        }}
      />

{/* DRAWER HORAIRES*/}
<ScheduleDrawer
  open={drawerOpen}
  onClose={() => {
    setDrawerOpen(false);
    refreshPlanningPreserveScroll();
  }}
  medecinId={selectedMedecinId ?? undefined}
  initialHoraires={{}}               // ⬅️ pas d’horaires chargés → safe
  mode={drawerMode}
  selectedDay={toISODate(drawerDate)} // ⬅️ ISO string accepté par le drawer
/>
    </div>
  );
}

