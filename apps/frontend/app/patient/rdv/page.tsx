"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar, {
  EventClickArg,
  CalendarApi,
  DatesSetArg,
} from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

// ✅ NEW
import MotifRdvModal from "./components/MotifRdvModal";

type RdvEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  extendedProps: {
    type: "taken" | "free";
  };
};

type CanBookResponse =
  | { canBook: true }
  | { canBook: false; reason?: "HAS_FUTURE_RDV" | string };

type BookingTarget =
  | { type: "patient"; patientId: number }
  | { type: "proche"; procheId: number };

type NextDispoDay = {
  date: string; // YYYY-MM-DD
  hours: string[]; // ["08:00","08:15",]
};

export default function RdvPage() {
  const router = useRouter();

  const [events, setEvents] = useState<RdvEvent[]>([]);
  const [medecinId, setMedecinId] = useState<number | null>(null);

  // patient connecté (owner)
  const [patient, setPatient] = useState<any>(null);

  // ✅ cible effective (patient OU proche) pour la règle "1 RDV futur"
  const [bookingTarget, setBookingTarget] = useState<BookingTarget | null>(
    null
  );

  // ✅ FIX: contexte verrouillé (évite race condition au 1er render)
  const [contextReady, setContextReady] = useState<boolean>(false);

  // RDV futur (pour la cible)
  const [futureRdv, setFutureRdv] = useState<any>(null);

  // ✅ EXISTANT
  const [accessError, setAccessError] = useState<string | null>(null);

  // ✅ Bloquer AVANT planning
  // null = en cours / inconnu ; true = autorisé ; false = interdit
  const [canBook, setCanBook] = useState<boolean | null>(null);

  // ✅ raison (pour distinguer CSV gate vs RDV futur)
  const [canBookReason, setCanBookReason] = useState<string | null>(null);

  // ✅ état de chargement du RDV futur (fallback)
  const [loadingExistingRdv, setLoadingExistingRdv] = useState<boolean>(false);

  // ✅ NEW : prochains jours dispos (5 jours avec au moins une dispo)
  const [nextDispos, setNextDispos] = useState<NextDispoDay[]>([]);
  const [loadingNextDispos, setLoadingNextDispos] = useState<boolean>(false);

  const calendarRef = useRef<any>(null);

  // ✅ NEW : gestion modale motif + slot en attente
  const [motifModalOpen, setMotifModalOpen] = useState<boolean>(false);
  const [pendingSlot, setPendingSlot] = useState<{
    date: string;
    heure: string;
  } | null>(null);

  // ✅ FIX (changement) : proche courant chargé (si for=proche)
  const [currentProche, setCurrentProche] = useState<any>(null);

  // ✅ helper: reset cohérent des états dépendants du contexte
  const resetContextStates = () => {
    setFutureRdv(null);
    setCanBook(null);
    setCanBookReason(null);
    setAccessError(null);

    setEvents([]);

    setNextDispos([]);
    setLoadingNextDispos(false);

    setLoadingExistingRdv(false);

    // ✅ NEW
    setMotifModalOpen(false);
    setPendingSlot(null);

    // ✅ FIX (changement)
    setCurrentProche(null);
  };

  const formatDateLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const add15 = (time: string): string => {
    const [h, m] = time.split(":").map(Number);
    const d = new Date();
    d.setHours(h);
    d.setMinutes(m + 15);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  };

  const buildTargetQueryString = (target: BookingTarget | null): string => {
    if (!target) return "";
    if (target.type === "patient") return `patientId=${target.patientId}`;
    return `procheId=${target.procheId}`;
  };

  // ✅ FIX CRITIQUE : canBook contrôle UNIQUEMENT la réservation (dispos + clic),
  // jamais l’accès à un RDV existant.
  const canSeeDispos = contextReady && canBook === true && !futureRdv;

  // ✅ NEW : récupère les 5 prochains JOURS avec au moins une dispo (et les heures de chaque jour)
  // maxLookahead protège en cas de planning vide
  async function fetchNextAvailableDays(
    maxDays = 5,
    maxLookahead = 30
  ): Promise<NextDispoDay[]> {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) return [];
    if (!medecinId || !patient || !bookingTarget || futureRdv) return [];
    if (!canSeeDispos) return [];

    const resDays: NextDispoDay[] = [];
    const now = new Date();

    // IMPORTANT: partir d'aujourd'hui (inclus)
    for (let i = 0; i < maxLookahead; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);

      const dateStr = formatDateLocal(d);

      try {
        const targetQs = buildTargetQueryString(bookingTarget);

        const res = await fetch(
          `http://localhost:3001/rdv/disponibilites` +
            `?medecinId=${medecinId}` +
            `&date=${dateStr}` +
            `&${targetQs}`
        );

        // Si 403 CSV gate: on garde ton comportement existant
        if (!res.ok) {
          if (res.status === 403) {
            setAccessError("Ce médecin ne prend pas de nouveaux patients.");
            setCanBook(false);
            setCanBookReason("CSV_GATE");
            setEvents([]);
            return [];
          }
          continue;
        }

        const hours: string[] = await res.json();
        if (Array.isArray(hours) && hours.length > 0) {
          resDays.push({ date: dateStr, hours });
          if (resDays.length >= maxDays) break;
        }
      } catch {
        // ignore et continue
      }
    }

    return resDays;
  }

  // ---------------------------------------------------------------------
  // Charger patient connecté
  // ---------------------------------------------------------------------
  useEffect(() => {
    let p =
      localStorage.getItem("patient") ??
      localStorage.getItem("patientSession") ??
      null;

    if (!p) {
      console.warn("⚠️ Aucun patient trouvé dans localStorage.");
      return;
    }

    try {
      const parsed = JSON.parse(p);
      parsed.id = Number(parsed.id);
      setPatient(parsed);

      // Vérification silencieuse
      fetch(`http://localhost:3001/patient/${parsed.id}`).catch(() => {
        console.warn("⚠️ Patient introuvable en BDD mais conservé côté client.");
      });
    } catch {
      localStorage.removeItem("patient");
      localStorage.removeItem("patientSession");
      console.error("❌ Patient localStorage corrompu → supprimé.");
    }
  }, []);

  // ---------------------------------------------------------------------
  // Lire medecinId
  // ---------------------------------------------------------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const mId = params.get("medecinId");
    if (mId) setMedecinId(Number(mId));
  }, []);

  // ✅ FIX (changement) : fetch proche (si for=proche)
  async function fetchProcheById(procheId: number) {
    try {
      const res = await fetch(`http://localhost:3001/proche/${procheId}`);
      if (!res.ok) throw new Error("proche fetch failed");
      const data = await res.json();
      setCurrentProche(data);
    } catch {
      // on ne bloque pas la page, mais on perd le match identité
      // et on garde ton fallback "HAS_FUTURE_RDV" UI sans détails.
      setCurrentProche(null);
    }
  }

  // ---------------------------------------------------------------------
  // ✅ calculer bookingTarget
  // - IMPORTANT : si for=proche MAIS procheId manquant => on ne fallback PAS en patient
  //   (sinon tu crois être en proche alors que la page passe en patient)
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!patient?.id) return;

    // ✅ FIX: on verrouille explicitement le contexte
    setContextReady(false);

    const params = new URLSearchParams(window.location.search);
    const forWho = params.get("for");
    const procheIdRaw = params.get("procheId");

    // reset états liés au contexte (évite stale state)
    resetContextStates();

    if (forWho === "proche") {
      if (!procheIdRaw) {
        setBookingTarget(null);
        setAccessError(
          "Impossible de prendre rendez-vous pour un proche : procheId manquant dans l’URL."
        );
        return;
      }

      const procheId = Number(procheIdRaw);
      if (isNaN(procheId)) {
        setBookingTarget(null);
        setAccessError(
          "Impossible de prendre rendez-vous pour un proche : procheId invalide."
        );
        return;
      }

      setBookingTarget({ type: "proche", procheId });

      // ✅ FIX (changement)
      fetchProcheById(procheId);

      setContextReady(true);
      return;
    }

    // default = patient (uniquement si for != proche)
    setBookingTarget({ type: "patient", patientId: Number(patient.id) });
    setContextReady(true);
  }, [patient]);

  // ---------------------------------------------------------------------
  // ✅ Vérifier le droit AVANT d'afficher le planning
  // - vérifie sur la CIBLE (patient OU proche)
  // - supporte { canBook: false, reason: ... }
  // - garde legacy 403 CSV gate
  // ---------------------------------------------------------------------
  useEffect(() => {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) return;
    if (!patient || !medecinId || !bookingTarget) return;

    setCanBook(null);
    setCanBookReason(null);
    setAccessError(null);

    // ✅ reset prochaines dispos lors du re-check canBook
    setNextDispos([]);
    setLoadingNextDispos(false);

    const targetQs = buildTargetQueryString(bookingTarget);

    fetch(
      `http://localhost:3001/rdv/can-book?medecinId=${medecinId}&${targetQs}`
    )
      .then(async (res) => {
        if (res.status === 403) {
          setCanBook(false);
          setCanBookReason("CSV_GATE");
          setAccessError("Ce médecin ne prend pas de nouveaux patients.");
          setEvents([]);
          return;
        }

        if (!res.ok) {
          throw new Error("can-book failed");
        }

        let data: CanBookResponse | null = null;
        try {
          data = (await res.json()) as CanBookResponse;
        } catch {
          data = null;
        }

        if (!data || typeof data !== "object") {
          setCanBook(true);
          setCanBookReason(null);
          return;
        }

        if ((data as any).canBook === false) {
          setCanBook(false);
          setCanBookReason(((data as any).reason as string) ?? "UNKNOWN");

          if ((data as any).reason === "HAS_FUTURE_RDV") {
            setAccessError("Vous avez déjà un rendez-vous avec ce médecin.");
          } else {
            setAccessError("Ce médecin ne prend pas de nouveaux patients.");
          }

          setEvents([]);
          return;
        }

        setCanBook(true);
        setCanBookReason(null);
      })
      .catch(() => {
        setCanBook(false);
        setCanBookReason("NETWORK_ERROR");
        setAccessError("Ce médecin ne prend pas de nouveaux patients.");
        setEvents([]);
      });
  }, [contextReady, patient, medecinId, bookingTarget]);

  // ---------------------------------------------------------------------
  // Helpers robustes API (array OU {rdvs})
  // ---------------------------------------------------------------------
  const coerceRdvList = (data: any): any[] | null => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rdvs)) return data.rdvs;
    return null;
  };

  // ✅ NEW helper : normalisation simple texte (pour match patientIdentity)
  const normalizeText = (v: any): string =>
    (v ?? "")
      .toString()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // ✅ FIX: pickFutureFromList aligné avec la logique backend :
  // - patient : match direct via patientId OU via patientIdentity (RDV créé par médecin/secrétaire/CSV)
  // - proche : match via procheId OU via patientIdentity (si proche chargé)
  const pickFutureFromList = (
    rdvs: any[],
    now: Date,
    target: BookingTarget,
    patientObj: any,
    procheObj?: any
  ) => {
    for (const r of rdvs) {
      if (!r?.date || !r?.heure) continue;

      const [h, m] = String(r.heure).split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) continue;

      const full = new Date(r.date);
      full.setHours(h, m, 0, 0);
      if (full < now) continue;

      // ─────────────────────────────────────────
      // 👤 PATIENT
      // ─────────────────────────────────────────
      if (target.type === "patient") {
        const directMatch =
          r.patientId != null &&
          Number(r.patientId) === Number(target.patientId);

        const identityMatch =
          !!r.patientIdentity &&
          !!patientObj &&
          normalizeText(r.patientIdentity.nom) === normalizeText(patientObj.nom) &&
          normalizeText(r.patientIdentity.prenom) ===
            normalizeText(patientObj.prenom);

        if (!directMatch && !identityMatch) continue;

        return r;
      }

      // ─────────────────────────────────────────
      // 👪 PROCHE
      // ─────────────────────────────────────────
      if (target.type === "proche") {
        // 1️⃣ match direct procheId (cas normal)
        if (
          r.procheId != null &&
          Number(r.procheId) === Number(target.procheId)
        ) {
          return r;
        }

        // 2️⃣ match identité proche (RDV créé par médecin/secrétaire) — nécessite currentProche
        if (
          !r.procheId &&
          r.patientIdentity &&
          procheObj &&
          normalizeText(r.patientIdentity.nom) === normalizeText(procheObj.nom) &&
          normalizeText(r.patientIdentity.prenom) ===
            normalizeText(procheObj.prenom)
        ) {
          return r;
        }

        continue;
      }
    }

    return null;
  };

  // ---------------------------------------------------------------------
  // Vérifier RDV futur (pour la cible) - FIX ROBUSTE
  // ---------------------------------------------------------------------
  async function checkFutureRdv() {
    if (!contextReady) return;
    if (!patient || !medecinId || !bookingTarget) return;

    const now = new Date();

    const urls: string[] = [];

    // 1️⃣ requête ciblée (patientId / procheId)
    urls.push(
      `http://localhost:3001/rdv?medecinId=${medecinId}&${buildTargetQueryString(
        bookingTarget
      )}`
    );

    // 2️⃣ ✅ FIX CRITIQUE
    // Cette vue est la SEULE qui remonte les RDV créés par médecin/secrétaire
    // quand patientId est NULL mais patientIdentity renseignée
    urls.push(
      `http://localhost:3001/patient/${patient.id}/rdv?medecinId=${medecinId}`
    );
    urls.push(`http://localhost:3001/patient/${patient.id}/rdv`);

    try {
      for (const url of urls) {
        const res = await fetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        const list = coerceRdvList(data);
        if (!list) continue;

        // filtre médecin si nécessaire
        const filtered = list.filter((r: any) => {
          const mid = r?.medecinId ?? r?.medecin?.id;
          if (!mid) return true;
          return Number(mid) === Number(medecinId);
        });

        // ✅ FIX (changement) : passer patient + currentProche
        const found = pickFutureFromList(
          filtered,
          now,
          bookingTarget,
          patient,
          currentProche
        );

        if (found) {
          setFutureRdv(found);
          return;
        }
      }

      setFutureRdv(null);
    } catch {
      setFutureRdv(null);
    }
  }

  useEffect(() => {
    // ✅ FIX: éviter trigger prématuré
    if (!contextReady) return;
    checkFutureRdv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, patient, medecinId, bookingTarget, currentProche]);

  // ---------------------------------------------------------------------
  // ✅ fallback : si le back dit HAS_FUTURE_RDV mais checkFutureRdv ne trouve rien
  // FIX : on doit aussi le lancer automatiquement quand on arrive sur la page
  // ---------------------------------------------------------------------
  async function fetchExistingFutureRdvFallback() {
    if (!contextReady) return;
    if (!patient || !medecinId || !bookingTarget) return;
    if (futureRdv) return;

    setLoadingExistingRdv(true);

    const now = new Date();

    const candidates: string[] = [];

    // 1️⃣ requête ciblée
    candidates.push(
      `http://localhost:3001/rdv?medecinId=${medecinId}&${buildTargetQueryString(
        bookingTarget
      )}`
    );

    // 2️⃣ ✅ FIX CRITIQUE — même logique que checkFutureRdv
    candidates.push(
      `http://localhost:3001/patient/${patient.id}/rdv?medecinId=${medecinId}`
    );
    candidates.push(`http://localhost:3001/patient/${patient.id}/rdv`);

    // 3️⃣ endpoints historiques conservés (au cas où)
    if (bookingTarget.type === "patient") {
      candidates.push(
        `http://localhost:3001/rdv/patient/${patient.id}?medecinId=${medecinId}`
      );
      candidates.push(`http://localhost:3001/rdv/patient/${patient.id}`);
    }

    if (bookingTarget.type === "proche") {
      candidates.push(
        `http://localhost:3001/rdv/proche/${bookingTarget.procheId}?medecinId=${medecinId}`
      );
      candidates.push(
        `http://localhost:3001/rdv/proche/${bookingTarget.procheId}`
      );
    }

    try {
      for (const url of candidates) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;

          const data = await res.json();
          const list = coerceRdvList(data);
          if (!list) continue;

          const filtered = list.filter((r: any) => {
            const mid = r?.medecinId ?? r?.medecin?.id;
            if (!mid) return true;
            return Number(mid) === Number(medecinId);
          });

          // ✅ FIX (changement) : passer patient + currentProche
          const found = pickFutureFromList(
            filtered,
            now,
            bookingTarget,
            patient,
            currentProche
          );

          if (found) {
            setFutureRdv(found);
            setLoadingExistingRdv(false);
            return;
          }
        } catch {
          // ignore et continue
        }
      }
    } finally {
      setLoadingExistingRdv(false);
    }
  }

  // ✅ FIX CRITIQUE : si on est bloqué HAS_FUTURE_RDV et qu’on n’a pas futureRdv,
  // lancer le fallback automatiquement (au lieu d’attendre un POST qui échoue)
  useEffect(() => {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) return;
    if (!patient || !medecinId || !bookingTarget) return;

    if (canBook === false && canBookReason === "HAS_FUTURE_RDV" && !futureRdv) {
      fetchExistingFutureRdvFallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contextReady,
    canBook,
    canBookReason,
    patient,
    medecinId,
    bookingTarget,
    futureRdv,
    currentProche,
  ]);

  // ---------------------------------------------------------------------
  // Charger disponibilités (CSV + cible)
  // ---------------------------------------------------------------------
  async function loadRange(start: Date, end: Date) {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) return;
    if (!medecinId || !patient || !bookingTarget || futureRdv) return;
    if (!canSeeDispos) return;

    setAccessError(null);
    const all: RdvEvent[] = [];
    const cur = new Date(start);

    while (cur < end) {
      const dateStr = formatDateLocal(cur);

      try {
        const targetQs = buildTargetQueryString(bookingTarget);

        const res = await fetch(
          `http://localhost:3001/rdv/disponibilites` +
            `?medecinId=${medecinId}` +
            `&date=${dateStr}` +
            `&${targetQs}`
        );

        if (!res.ok) {
          if (res.status === 403) {
            setAccessError("Ce médecin ne prend pas de nouveaux patients.");
            setCanBook(false);
            setCanBookReason("CSV_GATE");
            setEvents([]);
            return;
          }
          throw new Error();
        }

        const free: string[] = await res.json();

        free.forEach((h) => {
          all.push({
            id: `free-${dateStr}-${h}`,
            title: "Disponible",
            start: `${dateStr}T${h}`,
            end: `${dateStr}T${add15(h)}`,
            color: "#00c853",
            extendedProps: { type: "free" },
          });
        });
      } catch {}

      cur.setDate(cur.getDate() + 1);
    }

    setEvents(all);
  }

  async function handleDatesSet(arg: DatesSetArg) {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) return;

    if (!medecinId || futureRdv) return;
    if (!canSeeDispos) return;

    await loadRange(arg.start, arg.end);
  }

  useEffect(() => {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) return;

    if (!medecinId || futureRdv) return;
    if (!canSeeDispos) return;

    const api: CalendarApi | undefined = calendarRef.current?.getApi();
    if (!api) return;

    loadRange(api.view.activeStart, api.view.activeEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextReady, medecinId, futureRdv, canBook, bookingTarget]);

  // ---------------------------------------------------------------------
  // ✅ NEW : créer RDV (utilisé par calendrier + prochaines dispos)
  // ---------------------------------------------------------------------
  async function createRdvWithMotif(motif: string) {
    // garde-fous
    if (!contextReady) return;
    if (accessError || canBook !== true) return;
    if (!patient || !bookingTarget || !medecinId) return;
    if (!pendingSlot) return;
    if (futureRdv) return;

    const { date, heure } = pendingSlot;

    try {
      const createUrl =
        bookingTarget.type === "patient"
          ? `http://localhost:3001/patient/${patient.id}/rdv`
          : `http://localhost:3001/rdv/patient`;

      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          heure,
          motif,
          medecinId: medecinId,
          typeConsultation: "PRESENTIEL",

          ...(bookingTarget.type === "patient"
            ? { patientId: bookingTarget.patientId, procheId: null }
            : { procheId: bookingTarget.procheId, patientId: null }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // mêmes cas que ton code d'origine
        if (res.status === 403) {
          setCanBook(false);
          setCanBookReason("CSV_GATE");
          setAccessError(
            data?.message ||
              "Vous ne pouvez pas prendre de rendez-vous avec ce médecin."
          );
          setEvents([]);
        }

        if (
          typeof data?.message === "string" &&
          data.message.toLowerCase().includes("déjà un rendez-vous")
        ) {
          setCanBook(false);
          setCanBookReason("HAS_FUTURE_RDV");
          setAccessError("Vous avez déjà un rendez-vous avec ce médecin.");
          try {
            await checkFutureRdv();
            await fetchExistingFutureRdvFallback();
          } catch {}
        }

        alert(data?.message || "Erreur lors de la réservation.");

        try {
          await checkFutureRdv();
        } catch {}

        return;
      }

      alert("Rendez-vous réservé !");
      setFutureRdv(data);

      // ✅ NEW : vider les prochaines dispos (plus pertinent car plus bookable)
      setNextDispos([]);

      // ✅ fermer modale + reset pending
      setMotifModalOpen(false);
      setPendingSlot(null);

      // (optionnel) recharger le planning si le calendrier est monté
      const api: CalendarApi | undefined = calendarRef.current?.getApi();
      if (api && medecinId) {
        loadRange(api.view.activeStart, api.view.activeEnd);
      }
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la réservation.");
    }
  }

  // ---------------------------------------------------------------------
  // CLIC SUR CRÉNEAU
  // ---------------------------------------------------------------------
  async function handleEventClick(info: EventClickArg) {
    // ✅ FIX: attendre contexte stable
    if (!contextReady) {
      alert("Chargement en cours, veuillez réessayer.");
      return;
    }

    if (accessError || canBook !== true) {
      alert(
        accessError ??
          "Vous ne pouvez pas prendre de rendez-vous avec ce médecin."
      );
      return;
    }

    if (!patient) {
      alert("Vous devez être connecté en tant que patient pour réserver.");
      return;
    }

    if (!bookingTarget) {
      alert("Cible de rendez-vous non définie.");
      return;
    }

    if (futureRdv) {
      alert("Vous avez déjà un rendez-vous avec ce médecin.");
      return;
    }

    if (!medecinId) {
      alert("Médecin non sélectionné.");
      return;
    }

    const start = info.event.start;
    if (!start) return;

    const dateStr = formatDateLocal(start);
    const heure = start.toTimeString().slice(0, 5);

    // ✅ NEW : ouvrir modale motif au lieu de prompt()
    setPendingSlot({ date: dateStr, heure });
    setMotifModalOpen(true);
  }

  // ---------------------------------------------------------------------
  // ANNULATION
  // ---------------------------------------------------------------------
  async function cancelRdv() {
    if (!futureRdv) return;

    if (!confirm("Voulez-vous vraiment annuler ce rendez-vous ?")) return;

    try {
      const res = await fetch(
        `http://localhost:3001/rdv/patient/${futureRdv.id}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        alert("Rendez-vous annulé.");
        setFutureRdv(null);

        const api: CalendarApi | undefined = calendarRef.current?.getApi();
        if (api && medecinId) {
          loadRange(api.view.activeStart, api.view.activeEnd);
        }

        if (canBookReason === "HAS_FUTURE_RDV") {
          setCanBook(true);
          setCanBookReason(null);
          setAccessError(null);
        }

        // ✅ NEW : reset aussi les prochaines dispos
        setNextDispos([]);
      } else {
        alert("Erreur lors de l’annulation.");
      }
    } catch {
      alert("Erreur.");
    }
  }
  // ---------------------------------------------------------------------
  // Si bookingTarget impossible (ex: procheId manquant), on affiche erreur
  // ---------------------------------------------------------------------
  if (!bookingTarget && accessError) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push("/patient/choisir-medecin")}
          className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Retour au choix du médecin
        </button>

        <h1 className="text-3xl font-bold mb-4">📅 Rendez-vous</h1>

        <div className="mb-4 rounded border border-red-400 bg-red-100 p-4">
          {accessError}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // UI si la cible a un RDV futur
  // ---------------------------------------------------------------------
  if (futureRdv) {
    const fullDate = new Date(futureRdv.date);
    const [h, m] = String(futureRdv.heure).split(":").map(Number);
    fullDate.setHours(h, m, 0, 0);

    return (
      <div className="p-6">
        <button
          onClick={() => router.push("/patient/choisir-medecin")}
          className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Retour au choix du médecin
        </button>

        <h1 className="text-3xl font-bold mb-6">📅 Rendez-vous</h1>

        <div className="bg-yellow-100 border border-yellow-400 p-5 rounded-md text-lg">
          <p className="font-semibold mb-3">
            Vous avez déjà un rendez-vous prévu :
          </p>

          <p className="mb-4">
            <strong>
              {fullDate.toLocaleDateString("fr-FR")} à {futureRdv.heure}
            </strong>
          </p>

          <button
            onClick={cancelRdv}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md"
          >
            ❌ Annuler mon rendez-vous
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // UX : si interdit HAS_FUTURE_RDV, afficher même UI même sans détails
  // ---------------------------------------------------------------------
  if (canBook === false && canBookReason === "HAS_FUTURE_RDV") {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push("/patient/choisir-medecin")}
          className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Retour au choix du médecin
        </button>

        <h1 className="text-3xl font-bold mb-6">📅 Rendez-vous</h1>

        <div className="bg-yellow-100 border border-yellow-400 p-5 rounded-md text-lg">
          <p className="font-semibold mb-3">
            Vous avez déjà un rendez-vous prévu :
          </p>

          {loadingExistingRdv ? (
            <p className="mb-4">
              <strong>Chargement du rendez-vous...</strong>
            </p>
          ) : (
            <p className="mb-4">
              <strong>
                Impossible d’afficher la date/heure, mais un rendez-vous futur
                existe.
              </strong>
            </p>
          )}

          <button
            onClick={() => {
              if (!futureRdv) return;
              cancelRdv();
            }}
            disabled={!futureRdv}
            className={`px-4 py-2 rounded-md text-white ${
              futureRdv
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            ❌ Annuler mon rendez-vous
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // si interdit (CSV gate / autres), ne pas afficher calendrier
  // ---------------------------------------------------------------------
  if (canBook === false) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.push("/patient/choisir-medecin")}
          className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Retour au choix du médecin
        </button>

        <h1 className="text-3xl font-bold mb-4">📅 Rendez-vous</h1>

        <div className="mb-4 rounded border border-red-400 bg-red-100 p-4">
          {accessError ??
            "Vous ne pouvez pas prendre de rendez-vous avec ce médecin."}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // UI Calendrier (inchangée) + ✅ bouton prochaines dispos + liste
  // ---------------------------------------------------------------------
  return (
    <div className="p-6">
      <button
        onClick={() => router.push("/patient/choisir-medecin")}
        className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au choix du médecin
      </button>

      <h1 className="text-3xl font-bold mb-4">📅 Rendez-vous</h1>

      {accessError && (
        <div className="mb-4 rounded border border-red-400 bg-red-100 p-4">
          {accessError}
        </div>
      )}

      {/* ✅ NEW : bouton + rendu des 5 prochains jours où il y a au moins une dispo */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (!contextReady) return;
              if (!medecinId || !bookingTarget || futureRdv) return;
              if (!canSeeDispos) return;

              setLoadingNextDispos(true);
              setNextDispos([]);

              try {
                const data = await fetchNextAvailableDays(5, 30);
                setNextDispos(data);
              } finally {
                setLoadingNextDispos(false);
              }
            }}
            disabled={
              loadingNextDispos ||
              canBook !== true ||
              !medecinId ||
              !bookingTarget ||
              !!futureRdv ||
              !contextReady
            }
            className={`px-4 py-2 rounded ${
              loadingNextDispos ||
              canBook !== true ||
              !medecinId ||
              !bookingTarget ||
              !!futureRdv ||
              !contextReady
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {loadingNextDispos
              ? "Chargement des prochaines dispos..."
              : "Voir les prochaines dispos"}
          </button>

          {nextDispos.length > 0 && (
            <button
              onClick={() => setNextDispos([])}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Fermer
            </button>
          )}
        </div>

        {nextDispos.length > 0 && (
          <div className="rounded border border-gray-200 bg-white p-4">
            <p className="font-semibold mb-3">
              Prochains créneaux disponibles (5 jours max) :
            </p>

            <div className="flex flex-col gap-3">
              {nextDispos.map((d) => (
                <div key={d.date} className="border-b border-gray-100 pb-3">
                  <div className="font-semibold mb-2">
                    {new Date(d.date + "T00:00:00").toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {d.hours.map((h) => (
                      <button
                        key={`${d.date}-${h}`}
                        onClick={async () => {
                          if (!contextReady) {
                            alert("Chargement en cours, veuillez réessayer.");
                            return;
                          }

                          if (accessError || canBook !== true) {
                            alert(
                              accessError ??
                                "Vous ne pouvez pas prendre de rendez-vous avec ce médecin."
                            );
                            return;
                          }
                          if (!patient) {
                            alert(
                              "Vous devez être connecté en tant que patient pour réserver."
                            );
                            return;
                          }
                          if (!bookingTarget) {
                            alert("Cible de rendez-vous non définie.");
                            return;
                          }
                          if (futureRdv) {
                            alert(
                              "Vous avez déjà un rendez-vous avec ce médecin."
                            );
                            return;
                          }
                          if (!medecinId) {
                            alert("Médecin non sélectionné.");
                            return;
                          }

                          // ✅ NEW : ouvrir modale motif au lieu de prompt()
                          setPendingSlot({ date: d.date, heure: h });
                          setMotifModalOpen(true);
                        }}
                        className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {nextDispos.length === 0 && (
              <div className="text-gray-600">Aucune disponibilité trouvée.</div>
            )}
          </div>
        )}

        {!loadingNextDispos && nextDispos.length === 0 && (
          <div className="text-sm text-gray-600">
            Astuce : clique sur “Voir les prochaines dispos” pour afficher les
            prochains jours disponibles.
          </div>
        )}
      </div>

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek",
        }}
        locale="fr"
        firstDay={1}
        weekends={true}
        events={events}
        eventClick={handleEventClick}
        selectable={false}
        height="85vh"
        slotDuration="00:15:00"
        slotLabelInterval="00:15"
        slotMinTime="07:00"
        slotMaxTime="23:00"
        allDaySlot={false}
        expandRows={true}
        datesSet={handleDatesSet}
        slotLabelFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        dayHeaderFormat={{
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        }}
      />

      {/* ✅ NEW : MODALE MOTIF */}
      <MotifRdvModal
        open={motifModalOpen}
        onClose={() => {
          setMotifModalOpen(false);
          setPendingSlot(null);
        }}
        onConfirm={(motif) => createRdvWithMotif(motif)}
      />
    </div>
  );
}
