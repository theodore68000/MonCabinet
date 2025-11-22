"use client";

import { useEffect, useRef, useState } from "react";
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
  const [events, setEvents] = useState<RdvEvent[]>([]);
  const [medecinId, setMedecinId] = useState<number | null>(null);
  const [patient, setPatient] = useState<any>(null);

  // 🆕 RDV FUTUR si existe
  const [futureRdv, setFutureRdv] = useState<any>(null);

  const calendarRef = useRef<any>(null);

  // ⭐ Format local YYYY-MM-DD
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
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // Charger patient
  useEffect(() => {
    const p = localStorage.getItem("patient");
    if (!p) {
      window.location.href = "/patient/login";
      return;
    }
    setPatient(JSON.parse(p));
  }, []);

  // Lire medecinId dans URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mId = params.get("medecinId");
    if (mId) setMedecinId(Number(mId));
  }, []);

  // Vérifier si RDV futur existe
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

  // Charger plage calendrier
  async function loadRange(start: Date, end: Date) {
    if (!medecinId || futureRdv) return;

    const all: RdvEvent[] = [];

    let rdvs: any[] = [];
    try {
      const res = await fetch(
        `http://localhost:3001/rdv?medecinId=${medecinId}`
      );
      if (res.ok) rdvs = await res.json();
    } catch {}

    const cur = new Date(start);

    while (cur < end) {
      const dateStr = formatDateLocal(cur);
      const dow = cur.getDay();

      // RDV PRIS
      const dayRdvs = rdvs.filter((r) => {
        return formatDateLocal(new Date(r.date)) === dateStr;
      });

      dayRdvs.forEach((rdv) => {
        const startDt = `${dateStr}T${rdv.heure}`;
        const endDt = `${dateStr}T${add15(rdv.heure)}`;

        all.push({
          id: `taken-${rdv.id}`,
          title: "Pris",
          start: startDt,
          end: endDt,
          color: "red",
          extendedProps: { type: "taken" },
        });
      });

      // DISPONIBILITÉS UNIQUEMENT SI PAS DE FUTUR RDV
      if (!futureRdv && dow >= 1 && dow <= 5) {
        try {
          const resFree = await fetch(
            `http://localhost:3001/rdv/disponibilites?medecinId=${medecinId}&date=${dateStr}`
          );
          if (resFree.ok) {
            const free: string[] = await resFree.json();
            free.forEach((h) => {
              const startDt = `${dateStr}T${h}`;
              const endDt = `${dateStr}T${add15(h)}`;

              all.push({
                id: `free-${dateStr}-${h}`,
                title: "Disponible",
                start: startDt,
                end: endDt,
                color: "green",
                extendedProps: { type: "free" },
              });
            });
          }
        } catch {}
      }

      cur.setDate(cur.getDate() + 1);
    }

    setEvents(all);
  }

  // Update affichage semaine
  async function handleDatesSet(arg: DatesSetArg) {
    if (!medecinId || futureRdv) return;
    await loadRange(arg.start, arg.end);
  }

  // Recharger quand medecinId change
  useEffect(() => {
    if (!medecinId || futureRdv) return;

    const api: CalendarApi | undefined = calendarRef.current?.getApi();
    if (!api) return;

    loadRange(api.view.activeStart, api.view.activeEnd);
  }, [medecinId, futureRdv]);

  // Clic créneau
  async function handleEventClick(info: EventClickArg) {
    if (!patient) return;

    const type = info.event.extendedProps["type"];

    if (type === "taken") {
      alert("Ce créneau est déjà réservé.");
      return;
    }

    if (futureRdv) {
      alert("Vous avez déjà un rendez-vous. Vous ne pouvez pas en réserver un autre.");
      return;
    }

    const start = info.event.start!;
    const dateStr = formatDateLocal(start);
    const heure = start.toTimeString().slice(0, 5);

    const motif = prompt(
      `Prendre rendez-vous le ${dateStr} à ${heure}\n\nMotif :`
    );
    if (!motif) return;

    try {
      const res = await fetch("http://localhost:3001/rdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateStr,
          heure,
          motif,
          patientId: patient.id,
          medecinId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Erreur.");
        return;
      }

      alert("Rendez-vous réservé !");
      setFutureRdv(data); // nouveau RDV
    } catch {
      alert("Erreur lors de la réservation.");
    }
  }

  // 🆕 Annuler RDV
  async function cancelRdv() {
    if (!futureRdv) return;

    if (!confirm("Voulez-vous vraiment annuler ce rendez-vous ?")) return;

    try {
      const res = await fetch(`http://localhost:3001/rdv/${futureRdv.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        alert("Rendez-vous annulé.");
        setFutureRdv(null);
      } else {
        alert("Erreur lors de l’annulation.");
      }
    } catch {
      alert("Erreur lors de l’annulation.");
    }
  }

  // 🆕 AFFICHAGE SI RDV FUTUR EXISTE
  if (futureRdv) {
    const fullDate = new Date(futureRdv.date);
    const [h, m] = futureRdv.heure.split(":").map(Number);
    fullDate.setHours(h, m, 0, 0);

    const dateStr = fullDate.toLocaleDateString("fr-FR");
    const heureStr = futureRdv.heure;

    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">📅 Rendez-vous</h1>

        <div className="bg-yellow-100 border border-yellow-400 p-5 rounded-md text-lg">
          <p className="font-semibold mb-3">
            Vous avez déjà un rendez-vous prévu :
          </p>
          <p className="mb-4">
            <strong>{dateStr}</strong> à <strong>{heureStr}</strong>
          </p>

          <p className="mb-4">
            Vous pourrez réserver un nouveau créneau une fois ce rendez-vous passé.
            <br />
            Ou vous pouvez annuler votre rendez-vous actuel pour en choisir un autre.
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

  // Sinon → CALENDRIER NORMAL
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">📅 Rendez-vous</h1>

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
