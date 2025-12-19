"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import SidebarSecretaire from "./components/Sidebar";
import AddSlotModal, {
  ModalMode,
} from "../../medecin/dashboard/components/AddSlotModal";
import ScheduleDrawer from "../../medecin/dashboard/components/ScheduleDrawer";
import Tooltip from "./components/Tooltip";

/* -------------------------------------------------------
   TYPES
---------------------------------------------------------*/
type Secretaire = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  cabinetId: number;

  // ✅ AJOUT MINIMAL (profil complet)
  telephone?: string | null;
  cabinet?: { id: number; nom: string } | null;
};

type Medecin = {
  id: number;
  nom: string;
  prenom: string;
};

type Rdv = {
  id: number;
  date: string; // ISO
  heure: string;
  motif?: string | null;
  statut?: string;
  typeConsultation?: string | null;
  typeSlot?: string | null;
  patient?:
    | {
        id: number;
        nom: string;
        prenom: string;
        notePatient?: string | null;
      }
    | null;
};

type Horaires = {
  [key: string]: string[];
};

type ViewMode = "day" | "week" | "cabinetDay";

/* ------ Types pour la vue cabinet jour ------ */
type CabinetSlot = {
  heure: string;
  isVirtual: boolean;
  typeSlot: string; // "libre" | "pris" | "bloque" | "hors" | ...
  patient?:
    | {
        id: number;
        nom: string;
        prenom: string;
        notePatient?: string | null;
      }
    | null;
  proche?:
    | {
        id: number;
        nom: string;
        prenom: string;
      }
    | null;
  motif?: string | null;

  // ✅ CHANGE MINIMAL: non-optionnel pour garantir un contrat swap-safe
  rdvId: number | null;

  typeConsultation?: string | null;
};

type CabinetMedecinDay = {
  id: number;
  nom: string;
  prenom: string;
  horaires: any;
  slots: CabinetSlot[];
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
  if (e?.dataTransfer) {
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw="; // 1x1 transparent
    e.dataTransfer.setDragImage(img, 0, 0);
  }
};

/**
 * ✅ FIX: un créneau peut être "pris" même si rdv.patient est null/non inclus.
 * On se base sur typeSlot (vérité métier).
 */
const isRdvPris = (rdv?: Rdv | null) => {
  if (!rdv) return false;
  if (!rdv.typeSlot) return false;
  return rdv.typeSlot.toUpperCase() !== "LIBRE";
};

export default function SecretaireDashboard() {
  const router = useRouter();

  /* -------------------------------------------------------
     STATE
  ---------------------------------------------------------*/
  const [secretaire, setSecretaire] = useState<Secretaire | null>(null);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [selectedMedecinId, setSelectedMedecinId] = useState<number | null>(
    null
  );

  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [horaires, setHoraires] = useState<Horaires | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  /* --------- Planning cabinet pour la vue "Mode 1" --------- */
  const [cabinetPlanning, setCabinetPlanning] = useState<{
    date: string;
    medecins: CabinetMedecinDay[];
  } | null>(null);

  /* -------------------------------------------------------
     DRAWER HORAIRES
  ---------------------------------------------------------*/
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"day" | "week">("day");
  const [drawerDate, setDrawerDate] = useState<Date>(new Date());

  // ⭐ on laisse le même comportement UI (comme ton code),
  // mais on bloque l’ouverture dans openHorairesDrawer (pas de suppression UI)
  const canEditHoraires = viewMode === "day" || viewMode === "week";

  const openHorairesDrawer = (mode: "day" | "week", date: Date) => {
    // ✅ FIX MÉTIER: une secrétaire ne doit pas éditer les horaires
    // (on ne change pas l’UI, on bloque l’action)
    return;

    // if (!canEditHoraires) return; // ⭐ bloque la vue cabinet
    // if (!selectedMedecinId) return; // sécurité
    // setDrawerMode(mode);
    // setDrawerDate(date);
    // setDrawerOpen(true);
  };

  /* -------------------------------------------------------
     MODALE RDV
  ---------------------------------------------------------*/
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

  /* -------------------------------------------------------
     DRAG & DROP (toutes vues)
  ---------------------------------------------------------*/
  const [dragData, setDragData] = useState<{
    rdvId: number | null;
    fromMedecinId: number;
    fromDate: string; // "YYYY-MM-DD"
    fromHour: string;
    fromIsVirtual: boolean;
  } | null>(null);

  /* -------------------------------------------------------
     SESSION SECRÉTAIRE
  ---------------------------------------------------------*/
  useEffect(() => {
    const saved = localStorage.getItem("secretaireSession");
    if (!saved) return router.push("/secretaire/login");

    try {
      setSecretaire(JSON.parse(saved));
    } catch {
      localStorage.removeItem("secretaireSession");
      router.push("/secretaire/login");
    }
  }, [router]);

  /* -------------------------------------------------------
     ✅ AJOUT MINIMAL : HYDRATE PROFIL COMPLET
  ---------------------------------------------------------*/
  useEffect(() => {
    if (!secretaire?.id) return;

    const fetchSecretaireProfile = async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/secretaire/${secretaire.id}`
        );
        const data = await res.json().catch(() => null);

        if (res.ok && data?.id) {
          setSecretaire((prev) => ({
            ...(prev as any),
            ...(data as any),
          }));

          try {
            const existing = localStorage.getItem("secretaireSession");
            const parsed = existing ? JSON.parse(existing) : {};
            localStorage.setItem(
              "secretaireSession",
              JSON.stringify({ ...parsed, ...data })
            );
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

  /* -------------------------------------------------------
     FETCH MÉDECINS (FIX BACK) + FALLBACK
  ---------------------------------------------------------*/
  useEffect(() => {
    if (!secretaire) return;

    const fetchMedecins = async () => {
      // 1) Nouveau endpoint
      if (secretaire.id) {
        try {
          const res = await fetch(
            `http://localhost:3001/secretaire/${secretaire.id}/medecins`
          );
          const data = await res.json().catch(() => null);

          if (res.ok && data?.success && Array.isArray(data.medecins)) {
            if (data.medecins.length) {
              setMedecins(data.medecins);
              setSelectedMedecinId((prev) => prev ?? data.medecins[0].id);
            } else {
              setMedecins([]);
              setSelectedMedecinId(null);
            }
            return;
          }
        } catch {
          // on tente fallback
        }
      }

      // 2) Fallback ancien endpoint cabinet
      if (!secretaire.cabinetId) return;

      try {
        const res = await fetch(
          `http://localhost:3001/cabinet/${secretaire.cabinetId}`
        );
        const data = await res.json();

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

  /* -------------------------------------------------------
     HELPERS
  ---------------------------------------------------------*/
  const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;

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

    const dayKey = getDayKey(date);
    const plages = horaires[dayKey] || [];
    if (!plages.length) return false;

    const [h, m] = heure.split(":").map(Number);
    const minutes = h * 60 + m;

    for (const p of plages) {
      const [start, end] = p.split("-");
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);

      if (minutes >= sh * 60 + sm && minutes < eh * 60 + em) return true;
    }
    return false;
  };

  /* -------------------------------------------------------
     FETCH HORAIRES DU MÉDECIN SELECTIONNÉ
  ---------------------------------------------------------*/
  const fetchHoraires = async () => {
    if (!selectedMedecinId) return;
    if (viewMode === "cabinetDay") return;

    try {
      const res = await fetch(
        `http://localhost:3001/medecin/${selectedMedecinId}`
      );
      const data = await res.json();

      let parsed: any = null;
      if (data?.horaires) {
        parsed =
          typeof data.horaires === "string"
            ? JSON.parse(data.horaires)
            : data.horaires;
      }

      setHoraires(parsed);
    } catch {
      setHoraires(null);
    }
  };

  useEffect(() => {
    if (viewMode === "cabinetDay") return;
    fetchHoraires();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMedecinId, viewMode]);

  /* -------------------------------------------------------
     FETCH PLANNING MÉDECIN (JOUR / SEMAINE)
  ---------------------------------------------------------*/
  const fetchPlanning = async () => {
    if (!selectedMedecinId || viewMode === "cabinetDay") return;

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
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
      });

      const res = await fetch(
        `http://localhost:3001/rdv/medecin/${selectedMedecinId}?${params}`
      );
      const data = await res.json();

      if (!res.ok || data.success === false) {
        setError(data.message || "Erreur chargement planning.");
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
    if (viewMode === "cabinetDay") return;
    fetchPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMedecinId, selectedDate, viewMode]);

  /* -------------------------------------------------------
     FETCH PLANNING CABINET (MODE 1)
  ---------------------------------------------------------*/
  const fetchCabinetPlanning = async () => {
    if (!secretaire?.cabinetId) return;

    setLoading(true);
    setError("");
    setCabinetPlanning(null);

    const dateStr = toISODate(selectedDate);

    try {
      const res = await fetch(
        `http://localhost:3001/rdv/cabinet/${secretaire.cabinetId}/day?date=${dateStr}`
      );
      const data = await res.json();

      if (!res.ok || data.success === false) {
        setError(data.message || "Erreur chargement planning cabinet.");
        setCabinetPlanning(null);
        return;
      }

      // ✅ IMPORTANT: on force rdvId à exister (null si pas fourni)
      const normalizedMedecins: CabinetMedecinDay[] = (data.medecins || []).map(
        (m: any) => ({
          ...m,
          slots: (m.slots || []).map((s: any) => ({
            ...s,
            rdvId: s.rdvId ?? null,
          })),
        })
      );

      setCabinetPlanning({
        date: data.date,
        medecins: normalizedMedecins,
      });
    } catch {
      setError("Erreur serveur (planning cabinet).");
      setCabinetPlanning(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode !== "cabinetDay") return;
    fetchCabinetPlanning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedDate, secretaire?.cabinetId]);

  /* -------------------------------------------------------
     NAVIGATION
  ---------------------------------------------------------*/
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

  /* -------------------------------------------------------
     RDV LOOKUP (FIX TIMEZONE)
  ---------------------------------------------------------*/
  const getCellRdv = (dateStr: string, heure: string) =>
    rdvs.find((r) => {
      const d = new Date(r.date);
      const key = toISODate(d);
      return key === dateStr && r.heure === heure;
    });

  /* -------------------------------------------------------
     VISUEL SLOT CABINET
  ---------------------------------------------------------*/
  const getCabinetSlotVisual = (slot: CabinetSlot | undefined) => {
    if (!slot) {
      return {
        label: "",
        className: "bg-slate-900/40 border border-slate-800 text-slate-500",
        showMotif: false,
      };
    }

    const type = (slot.typeSlot || "").toLowerCase();
    const hasPatient = !!slot.patient || !!slot.proche;

    if (type === "bloque") {
      return {
        label: "Bloqué",
        className: "bg-slate-900/60 border border-slate-700 text-slate-400",
        showMotif: false,
      };
    }

    if (type === "pris" || hasPatient) {
      const base = slot.patient
        ? `${slot.patient.prenom} ${slot.patient.nom}`
        : "Pris";
      const label = base + (slot.typeConsultation === "VISIO" ? " (Visio)" : "");

      return {
        label,
        className:
          slot.typeConsultation === "VISIO"
            ? "bg-purple-600/25 border border-purple-400/60 text-purple-100"
            : "bg-emerald-600/25 border border-emerald-400/60 text-emerald-100",
        showMotif: true,
      };
    }

    if (type === "libre") {
      return {
        label: "Libre",
        className: "bg-blue-600/25 border border-blue-400/60 text-blue-100",
        showMotif: false,
      };
    }

    if (type === "hors") {
      return {
        label: "",
        className: "bg-slate-950 border border-slate-900 text-slate-600",
        showMotif: false,
      };
    }

    return {
      label: "",
      className: "bg-slate-900/40 border border-slate-800 text-slate-500",
      showMotif: false,
    };
  };

  /* -------------------------------------------------------
     OPEN MODAL RDV
  ---------------------------------------------------------*/
  const openSlotModal = (
    date: string,
    heure: string,
    mode: ModalMode,
    rdvId?: number | null,
    initialPatientId?: number | null,
    initialTypeConsultation?: string | null,
    medecinIdOverride?: number | null
  ) => {
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

  /* -------------------------------------------------------
     HANDLE DROP — LOGIQUE GÉNÉRIQUE SWAP / MOVE
  ---------------------------------------------------------*/

  // 🔁 DRAG & DROP SUR VUES MÉDECIN (jour + semaine)
  const handleDropMedecin = async (toDateStr: string, toHour: string) => {
    if (!dragData || !selectedMedecinId) return;

    const { fromDate, fromHour } = dragData;
    setDragData(null);

    if (fromDate === toDateStr && fromHour === toHour) {
      return;
    }

    const fromRdv = getCellRdv(fromDate, fromHour);
    const toRdv = getCellRdv(toDateStr, toHour);

    const fromRealId = fromRdv?.id ?? null;
    const toRealId = toRdv?.id ?? null;

    if (fromRealId && toRealId) {
      try {
        const res = await fetch("http://localhost:3001/rdv/swap/secretaire", {
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

    if (fromRealId && !toRealId) {
      try {
        const res = await fetch(
          `http://localhost:3001/rdv/${fromRealId}/secretaire`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: toDateStr,
              heure: toHour,
              medecinId: selectedMedecinId,
            }),
          }
        );

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
          alert("Impossible de créer un créneau pour effectuer l'échange.");
          return;
        }

        const createData = await createRes.json();
        const newId: number | undefined = createData?.rdv?.id;

        if (!newId) {
          alert("Erreur interne lors de la création du créneau.");
          return;
        }

        const swapRes = await fetch("http://localhost:3001/rdv/swap/secretaire", {
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
          alert("Impossible de créer un créneau pour le déplacement.");
          return;
        }

        const createData = await createRes.json();
        const newId: number | undefined = createData?.rdv?.id;

        if (!newId) {
          alert("Erreur interne lors de la création du créneau.");
          return;
        }

        const updateRes = await fetch(
          `http://localhost:3001/rdv/${newId}/secretaire`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: toDateStr,
              heure: toHour,
              medecinId: selectedMedecinId,
            }),
          }
        );

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

  // 🔁 DRAG & DROP SUR VUE CABINET JOUR
  const handleDropCabinet = async (toMedecinId: number, toHour: string) => {
    if (!dragData || !cabinetPlanning) return;

    const { fromMedecinId, fromDate, fromHour } = dragData;
    setDragData(null);

    const date = cabinetPlanning.date;

    if (
      fromMedecinId === toMedecinId &&
      fromHour === toHour &&
      fromDate === date
    ) {
      return;
    }

    const fromMed = cabinetPlanning.medecins.find((m) => m.id === fromMedecinId);
    const toMed = cabinetPlanning.medecins.find((m) => m.id === toMedecinId);

    const fromSlot = fromMed?.slots.find((s) => s.heure === fromHour);
    const toSlot = toMed?.slots.find((s) => s.heure === toHour);

    // ✅ CHANGE MINIMAL: ids robustes (évite undefined/string)
    const fromRealId = Number.isFinite(Number(fromSlot?.rdvId))
      ? Number(fromSlot?.rdvId)
      : null;
    const toRealId = Number.isFinite(Number(toSlot?.rdvId))
      ? Number(toSlot?.rdvId)
      : null;

    // 1) Deux RDV réels → SWAP (PRIS↔PRIS compris)
    if (fromRealId && toRealId) {
      try {
        const res = await fetch("http://localhost:3001/rdv/swap/secretaire", {
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

        await fetchCabinetPlanning();
      } catch {
        alert("Erreur serveur lors de l'échange des rendez-vous.");
      }
      return;
    }

    // 2) From réel → To virtuel
    if (fromRealId && !toRealId) {
      try {
        const res = await fetch(
          `http://localhost:3001/rdv/${fromRealId}/secretaire`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date,
              heure: toHour,
              medecinId: toMedecinId,
            }),
          }
        );

        if (!res.ok) {
          alert("Impossible de déplacer le rendez-vous.");
          return;
        }

        await fetchCabinetPlanning();
      } catch {
        alert("Erreur serveur lors du déplacement du rendez-vous.");
      }
      return;
    }

    // 3) From virtuel → To réel → créer slot à l'origine puis SWAP
    if (!fromRealId && toRealId) {
      try {
        const createRes = await fetch("http://localhost:3001/rdv/slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medecinId: fromMedecinId,
            date,
            heure: fromHour,
            typeSlot: "LIBRE",
          }),
        });

        if (!createRes.ok) {
          alert("Impossible de créer un créneau pour l'échange.");
          return;
        }

        const createData = await createRes.json();
        const newId: number | undefined = createData?.rdv?.id;

        if (!newId) {
          alert("Erreur interne lors de la création du créneau.");
          return;
        }

        const swapRes = await fetch("http://localhost:3001/rdv/swap/secretaire", {
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

        await fetchCabinetPlanning();
      } catch {
        alert("Erreur serveur lors de l'échange du rendez-vous.");
      }
      return;
    }

    // 4) From virtuel → To virtuel : on crée un LIBRE à l'origine puis on le déplace
    if (!fromRealId && !toRealId) {
      try {
        const createRes = await fetch("http://localhost:3001/rdv/slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medecinId: fromMedecinId,
            date,
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

        const updateRes = await fetch(
          `http://localhost:3001/rdv/${newId}/secretaire`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date,
              heure: toHour,
              medecinId: toMedecinId,
            }),
          }
        );

        if (!updateRes.ok) {
          alert("Impossible de déplacer le créneau libre.");
          return;
        }

        await fetchCabinetPlanning();
      } catch {
        alert("Erreur serveur lors du déplacement du créneau.");
      }
    }
  };

  /* -------------------------------------------------------
     RENDER
  ---------------------------------------------------------*/
  return (
    <div className="flex bg-slate-950 text-white min-h-screen">
      <SidebarSecretaire />

      <div className="flex-1 p-8 max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">
              Dashboard secrétaire
            </h1>
            <p className="text-slate-400">
              {secretaire?.prenom} {secretaire?.nom}
            </p>
          </div>

          {/* ---- SELECTEUR DE MODE ---- */}
          <div className="flex flex-col items-end gap-2">
            <select
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
              onChange={(e) => {
                const val = e.target.value;

                if (val === "cabinet") {
                  setViewMode("cabinetDay");
                  return;
                }

                if (val.startsWith("medecin-")) {
                  const id = Number(val.replace("medecin-", ""));
                  setSelectedMedecinId(id);
                  setViewMode("week");
                  return;
                }
              }}
            >
              <option value="cabinet">🏥 Cabinet — Journée</option>

              {medecins.map((m) => (
                <option key={m.id} value={`medecin-${m.id}`}>
                  📅 Semaine Dr {m.prenom} {m.nom}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PLANNING */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
          {/* Nav */}
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

                {canEditHoraires ? (
                  <button
                    onClick={() => openHorairesDrawer("day", selectedDate)}
                    className="underline text-emerald-400 hover:text-emerald-300"
                  >
                    {formatDate(selectedDate)}
                  </button>
                ) : (
                  <span className="text-emerald-300">
                    {formatDate(selectedDate)}
                  </span>
                )}

                <button
                  onClick={goNextDay}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ▶
                </button>
              </div>
            ) : viewMode === "week" ? (
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={goPrevWeek}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ◀
                </button>

                {canEditHoraires ? (
                  <button
                    onClick={() => openHorairesDrawer("week", weekStart)}
                    className="underline text-emerald-400 hover:text-emerald-300"
                  >
                    Semaine du {toISODate(weekStart)}
                  </button>
                ) : (
                  <span className="text-emerald-300">
                    Semaine du {toISODate(weekStart)}
                  </span>
                )}

                <button
                  onClick={goNextWeek}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ▶
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={goPrevDay}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ◀
                </button>

                <span className="text-emerald-300 font-medium">
                  {formatDate(selectedDate)} — Cabinet
                </span>

                <button
                  onClick={goNextDay}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
                >
                  ▶
                </button>
              </div>
            )}
          </div>

          {/* Loader / erreurs */}
          {loading && <p className="text-slate-400 text-sm">Chargement...</p>}
          {error && !loading && (
            <p className="text-red-400 text-sm mb-2">{error}</p>
          )}
          {!loading && !error && !horaires && viewMode !== "cabinetDay" && (
            <p className="text-slate-400 text-sm">Chargement des horaires...</p>
          )}

          {/* MODE JOUR */}
          {viewMode === "day" && !loading && !error && horaires && (
            <>
              {(() => {
                const dayDateStr = toISODate(selectedDate);
                const daySlots = hours.filter((h) =>
                  isWithinHoraires(selectedDate, h)
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
                      const isBlocked =
                        rdv?.statut === "indisponible" ||
                        rdv?.typeSlot?.toLowerCase() === "bloque";

                      const isBooked = isRdvPris(rdv);

                      let displayLabel = isBooked ? "Pris" : "Libre";
                      let cardClass =
                        "bg-blue-600/20 border-blue-500/40 text-blue-100";

                      if (isBlocked) {
                        displayLabel = "";
                        cardClass =
                          "bg-slate-900/40 border-slate-700 text-slate-500";
                      } else if (isBooked) {
                        displayLabel = rdv?.patient
                          ? `${rdv.patient.prenom} ${rdv.patient.nom}`
                          : "Pris";

                        cardClass =
                          rdv?.typeConsultation === "VISIO"
                            ? "bg-purple-600/30 border-purple-400/40 text-purple-100"
                            : "bg-emerald-600/20 border-emerald-500/40 text-emerald-100";
                      }

                      return (
                        <Tooltip
                          key={hour}
                          text={rdv?.patient?.notePatient || ""}
                        >
                          <div
                            className={`border px-4 py-3 rounded-xl flex justify-between items-center cursor-pointer hover:brightness-110 transition ${cardClass}`}
                            onClick={() =>
                              openSlotModal(
                                dayDateStr,
                                hour,
                                "click",
                                rdv?.id ?? null,
                                rdv?.patient?.id ?? null,
                                rdv?.typeConsultation ?? null
                              )
                            }
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropMedecin(dayDateStr, hour)}
                          >
                            <div
                              draggable
                              onDragStart={(e) => {
                                if (!selectedMedecinId) return;
                                makeDragImageInvisible(e);
                                setDragData({
                                  rdvId: rdv?.id ?? null,
                                  fromMedecinId: selectedMedecinId,
                                  fromDate: dayDateStr,
                                  fromHour: hour,
                                  fromIsVirtual: !rdv,
                                });
                              }}
                            >
                              <p className="font-semibold">
                                {hour}
                                {displayLabel && ` — ${displayLabel}`}
                                {rdv?.typeConsultation === "VISIO" &&
                                  " (Visio)"}
                              </p>

                              {rdv?.motif && !isBlocked && (
                                <p className="text-xs text-slate-200 italic mt-1">
                                  {rdv.motif}
                                </p>
                              )}
                            </div>
                          </div>
                        </Tooltip>
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
                {/* Headers */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] text-center mb-2 text-xs">
                  <div></div>
                  {daysOfWeek.map((d) => (
                    <div
                      key={d.toISOString()}
                      className={`text-slate-300 ${
                        canEditHoraires
                          ? "cursor-pointer hover:text-emerald-400"
                          : ""
                      }`}
                      onClick={() =>
                        canEditHoraires && openHorairesDrawer("day", d)
                      }
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

                {/* GRID */}
                <div className="grid grid-cols-[80px_repeat(7,1fr)] text-[11px]">
                  {hours.map((hour) => (
                    <Fragment key={hour}>
                      <div className="h-10 flex items-center justify-center text-slate-400 border-t border-slate-800">
                        {hour}
                      </div>

                      {daysOfWeek.map((d) => {
                        const dateStr = toISODate(d);
                        const rdv = getCellRdv(dateStr, hour);

                        const inHoraires = isWithinHoraires(d, hour);
                        const isBlocked =
                          rdv?.statut === "indisponible" ||
                          rdv?.typeSlot?.toLowerCase() === "bloque";

                        const isBooked = isRdvPris(rdv);

                        const handleClick = () =>
                          openSlotModal(
                            dateStr,
                            hour,
                            "click",
                            rdv?.id ?? null,
                            rdv?.patient?.id ?? null,
                            rdv?.typeConsultation ?? null
                          );

                        if (rdv) {
                          if (isBlocked) {
                            return (
                              <Tooltip
                                key={dateStr + hour}
                                text={rdv.patient?.notePatient || ""}
                              >
                                <div
                                  className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer"
                                  onClick={handleClick}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() =>
                                    handleDropMedecin(dateStr, hour)
                                  }
                                >
                                  <div
                                    className="h-full rounded-lg bg-slate-900/40 border border-slate-700"
                                    draggable
                                    onDragStart={(e) => {
                                      if (!selectedMedecinId) return;
                                      makeDragImageInvisible(e);
                                      setDragData({
                                        rdvId: rdv.id,
                                        fromMedecinId: selectedMedecinId,
                                        fromDate: dateStr,
                                        fromHour: hour,
                                        fromIsVirtual: false,
                                      });
                                    }}
                                  />
                                </div>
                              </Tooltip>
                            );
                          }

                          const className = isBooked
                            ? rdv.typeConsultation === "VISIO"
                              ? "bg-purple-600/20 border-purple-400/60 text-purple-100"
                              : "bg-emerald-600/20 border-emerald-500/60 text-emerald-100"
                            : "bg-blue-600/20 border-blue-500/60 text-blue-100";

                          return (
                            <Tooltip
                              key={dateStr + hour}
                              text={rdv.patient?.notePatient || ""}
                            >
                              <div
                                className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer"
                                onClick={handleClick}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => handleDropMedecin(dateStr, hour)}
                              >
                                <div
                                  className={`h-full rounded-lg px-2 flex flex-col justify-center ${className}`}
                                  draggable
                                  onDragStart={(e) => {
                                    if (!selectedMedecinId) return;
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
                                    {isBooked
                                      ? rdv.patient
                                        ? `${rdv.patient.prenom} ${rdv.patient.nom}`
                                        : "Pris"
                                      : "Libre"}
                                    {rdv.typeConsultation === "VISIO" &&
                                      " (Visio)"}
                                  </span>
                                  {rdv.motif && (
                                    <span className="text-[10px] italic truncate">
                                      {rdv.motif}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Tooltip>
                          );
                        }

                        const isDraggable = inHoraires;

                        return (
                          <div
                            key={dateStr + hour}
                            className="h-10 border-t border-slate-800 px-1 py-1 cursor-pointer"
                            onClick={handleClick}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDropMedecin(dateStr, hour)}
                          >
                            <div
                              className={`h-full rounded-lg flex items-center justify-center ${
                                inHoraires
                                  ? "bg-blue-600/20 border border-blue-500/60 text-blue-100"
                                  : "bg-slate-900/40 border border-slate-700"
                              }`}
                              draggable={isDraggable}
                              onDragStart={(e) => {
                                if (!selectedMedecinId || !inHoraires) return;
                                makeDragImageInvisible(e);
                                setDragData({
                                  rdvId: null,
                                  fromMedecinId: selectedMedecinId,
                                  fromDate: dateStr,
                                  fromHour: hour,
                                  fromIsVirtual: true,
                                });
                              }}
                            >
                              {inHoraires && "Libre"}
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

          {/* MODE CABINET JOUR (Mode 1) */}
          {viewMode === "cabinetDay" &&
            !loading &&
            !error &&
            cabinetPlanning && (
              <>
                {cabinetPlanning.medecins.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    Aucun médecin trouvé pour ce cabinet.
                  </p>
                ) : (
                  <div className="overflow-x-auto mt-2">
                    <div className="min-w-[900px]">
                      {/* Header : colonnes médecins */}
                      <div
                        className="grid text-center mb-2 text-xs"
                        style={{
                          gridTemplateColumns: `80px repeat(${cabinetPlanning.medecins.length}, minmax(0,1fr))`,
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

                      {/* GRID */}
                      <div
                        className="grid text-[11px]"
                        style={{
                          gridTemplateColumns: `80px repeat(${cabinetPlanning.medecins.length}, minmax(0,1fr))`,
                        }}
                      >
                        {hours.map((hour) => (
                          <Fragment key={hour}>
                            <div className="h-10 flex items-center justify-center text-slate-400 border-t border-slate-800">
                              {hour}
                            </div>

                            {cabinetPlanning.medecins.map((m) => {
                              const slot = m.slots.find((s) => s.heure === hour);
                              const visual = getCabinetSlotVisual(slot);

                              const handleClick = () =>
                                openSlotModal(
                                  cabinetPlanning.date,
                                  hour,
                                  "click",
                                  slot?.rdvId ?? null,
                                  slot?.patient?.id ?? null,
                                  slot?.typeConsultation ?? null,
                                  m.id
                                );

                              const isDraggable =
                                !!slot &&
                                slot.typeSlot.toLowerCase() !== "hors";

                              return (
                                <div
                                  key={`${m.id}-${hour}`}
                                  className="h-10 border-t border-slate-800 px-1 py-1"
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                  }}
                                  onDrop={() => handleDropCabinet(m.id, hour)}
                                >
                                  <Tooltip
                                    text={slot?.patient?.notePatient || ""}
                                  >
                                    <div
                                      className={`h-full rounded-lg px-2 flex flex-col justify-center ${visual.className} ${
                                        slot
                                          ? "cursor-pointer hover:brightness-110 transition"
                                          : ""
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
                                          fromIsVirtual:
                                            slot.isVirtual || !slot.rdvId,
                                        });
                                      }}
                                      onClick={handleClick}
                                    >
                                      {visual.label && (
                                        <span className="font-semibold truncate">
                                          {visual.label}
                                        </span>
                                      )}
                                      {visual.showMotif && slot?.motif && (
                                        <span className="text-[10px] italic truncate">
                                          {slot.motif}
                                        </span>
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
                )}
              </>
            )}
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

      {/* DRAWER HORAIRES (intact — mais ouverture bloquée dans openHorairesDrawer) */}
      <ScheduleDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          fetchHoraires();
          fetchPlanning();
        }}
        medecinId={selectedMedecinId ?? undefined}
        initialHoraires={horaires}
        mode={drawerMode}
        selectedDay={DAY_NAMES[drawerDate.getDay()]}
      />
    </div>
  );
}
