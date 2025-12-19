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

export default function RdvPage() {
  const router = useRouter();

  const [events, setEvents] = useState<RdvEvent[]>([]);
  const [medecinId, setMedecinId] = useState<number | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [futureRdv, setFutureRdv] = useState<any>(null);

  // ✅ EXISTANT
  const [accessError, setAccessError] = useState<string | null>(null);

  // ✅ NOUVEAU (bloquer AVANT planning)
  // null = en cours / inconnu ; true = autorisé ; false = interdit
  const [canBook, setCanBook] = useState<boolean | null>(null);

  const calendarRef = useRef<any>(null);

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

  // ---------------------------------------------------------------------
  // Charger patient
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

  // ---------------------------------------------------------------------
  // ✅ NOUVEAU : Vérifier le droit AVANT d'afficher le planning
  // ---------------------------------------------------------------------
useEffect(() => {
  if (!patient || !medecinId) return;

  setCanBook(null);
  setAccessError(null);

  fetch(
    `http://localhost:3001/rdv/can-book?medecinId=${medecinId}&patientId=${patient.id}`
  )
    .then(async (res) => {
      if (res.status === 403) {
        setCanBook(false);
        setAccessError("Ce médecin ne prend pas de nouveaux patients.");
        setEvents([]);
        return;
      }

      if (!res.ok) {
        throw new Error("can-book failed");
      }

      // ✅ 200 = autorisé
      setCanBook(true);
    })
    .catch(() => {
      // fallback safe : on bloque seulement en cas d’erreur réseau
      setCanBook(false);
      setAccessError("Ce médecin ne prend pas de nouveaux patients.");
      setEvents([]);
    });
}, [patient, medecinId]);


  // ---------------------------------------------------------------------
  // Vérifier RDV futur
  // ---------------------------------------------------------------------
  async function checkFutureRdv() {
    if (!patient || !medecinId) return;

    try {
      const res = await fetch(
        `http://localhost:3001/rdv?medecinId=${medecinId}&patientId=${patient.id}`
      );
      if (!res.ok) return;

      const rdvs = await res.json();
      const now = new Date();

      for (const r of rdvs) {
        const full = new Date(r.date);
        const [h, m] = r.heure.split(":").map(Number);
        full.setHours(h, m, 0, 0);

        if (full >= now) {
          setFutureRdv(r);
          return;
        }
      }

      setFutureRdv(null);
    } catch {
      setFutureRdv(null);
    }
  }

  useEffect(() => {
    checkFutureRdv();
  }, [patient, medecinId]);

  // ---------------------------------------------------------------------
  // Charger disponibilités (FIX CSV)
  // ---------------------------------------------------------------------
  async function loadRange(start: Date, end: Date) {
    if (!medecinId || !patient || futureRdv) return;

    // ✅ NOUVEAU : si non autorisé, on ne charge rien
    if (canBook === false) return;

    setAccessError(null);
    const all: RdvEvent[] = [];
    const cur = new Date(start);

    while (cur < end) {
      const dateStr = formatDateLocal(cur);

      try {
        const res = await fetch(
          `http://localhost:3001/rdv/disponibilites` +
            `?medecinId=${medecinId}` +
            `&date=${dateStr}` +
            `&patientId=${patient.id}`
        );

        if (!res.ok) {
          if (res.status === 403) {
            setAccessError("Ce médecin ne prend pas de nouveaux patients.");
            setCanBook(false); // ✅ verrouillage
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
    if (!medecinId || futureRdv) return;

    // ✅ NOUVEAU : ne pas charger si interdit ou en cours de check
    if (canBook === false || canBook === null) return;

    await loadRange(arg.start, arg.end);
  }

  useEffect(() => {
    if (!medecinId || futureRdv) return;

    // ✅ NOUVEAU : ne pas charger si interdit ou en cours de check
    if (canBook === false || canBook === null) return;

    const api: CalendarApi | undefined = calendarRef.current?.getApi();
    if (!api) return;

    loadRange(api.view.activeStart, api.view.activeEnd);
  }, [medecinId, futureRdv, canBook]);

  // ---------------------------------------------------------------------
  // CLIC SUR CRÉNEAU
  // ---------------------------------------------------------------------
  async function handleEventClick(info: EventClickArg) {
    if (accessError || canBook === false) {
      alert(accessError ?? "Vous ne pouvez pas prendre de rendez-vous avec ce médecin.");
      return;
    }

    if (!patient) {
      alert("Vous devez être connecté en tant que patient pour réserver.");
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

    const motif = prompt(`Prendre rendez-vous le ${dateStr} à ${heure}\n\nMotif :`);
    if (!motif) return;

    try {
      const res = await fetch(`http://localhost:3001/patient/${patient.id}/rdv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          heure,
          motif,
          medecinId: medecinId, // number
          typeConsultation: "PRESENTIEL",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // ✅ NOUVEAU : si le back refuse (CSV), on bloque l’UX immédiatement
        if (res.status === 403) {
          setCanBook(false);
          setAccessError("Ce médecin ne prend pas de nouveaux patients.");
          setEvents([]);
        }
        alert(data?.message || "Erreur lors de la réservation.");
        return;
      }

      alert("Rendez-vous réservé !");
      setFutureRdv(data);
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la réservation.");
    }
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
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        alert("Rendez-vous annulé.");
        setFutureRdv(null);

        const api: CalendarApi | undefined = calendarRef.current?.getApi();
        if (api && medecinId) {
          loadRange(api.view.activeStart, api.view.activeEnd);
        }
      } else {
        alert("Erreur lors de l’annulation.");
      }
    } catch {
      alert("Erreur.");
    }
  }

  // ---------------------------------------------------------------------
  // UI si patient a RDV futur
  // ---------------------------------------------------------------------
  if (futureRdv) {
    const fullDate = new Date(futureRdv.date);
    const [h, m] = futureRdv.heure.split(":").map(Number);
    fullDate.setHours(h, m, 0, 0);

    return (
      <div className="p-6">
        {/* 🔙 RETOUR */}
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
  // ✅ NOUVEAU : si interdit, on n’affiche pas le calendrier (mais on garde le layout)
  // ---------------------------------------------------------------------
  if (canBook === false) {
    return (
      <div className="p-6">
        {/* 🔙 RETOUR */}
        <button
          onClick={() => router.push("/patient/choisir-medecin")}
          className="mb-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Retour au choix du médecin
        </button>

        <h1 className="text-3xl font-bold mb-4">📅 Rendez-vous</h1>

        <div className="mb-4 rounded border border-red-400 bg-red-100 p-4">
          {accessError ?? "Vous ne pouvez pas prendre de rendez-vous avec ce médecin."}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // UI Calendrier
  // ---------------------------------------------------------------------
  return (
    <div className="p-6">
      {/* 🔙 RETOUR */}
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

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "timeGridDay,timeGridWeek",
        }}
        firstDay={1}
        weekends={true}
        events={events}
        eventClick={handleEventClick}
        selectable={false}
        height="85vh"
        slotDuration="00:15:00"
        slotLabelInterval="00:15"
        slotMinTime="08:00"
        slotMaxTime="19:00"
        allDaySlot={false}
        expandRows={true}
        datesSet={handleDatesSet}
      />
    </div>
  );
}
