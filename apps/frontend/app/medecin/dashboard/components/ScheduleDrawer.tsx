"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Trash } from "lucide-react";
import TimeField from "./TimeField";

type Props = {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  medecinId?: number;
  initialHoraires: any;
  mode: "day" | "week";
  selectedDay?: string;
};

const ORDER = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

const DAY_INDEX: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

export default function ScheduleDrawer({
  open,
  onClose,
  medecinId,
  initialHoraires,
  mode,
  selectedDay,
}: Props) {
  /* ---------------- STATE ---------------- */
  const [localHoraires, setLocalHoraires] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [newStart, setNewStart] = useState<Record<string, string>>({});
  const [newEnd, setNewEnd] = useState<Record<string, string>>({});

  // ✅ refs pour focus auto (début -> fin)
  const startRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const endRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* ---------------- INIT ---------------- */
  useEffect(() => {
    const clone =
      typeof initialHoraires === "string"
        ? initialHoraires
          ? JSON.parse(initialHoraires)
          : {}
        : initialHoraires || {};
    setLocalHoraires(JSON.parse(JSON.stringify(clone)));
  }, [initialHoraires]);

  /* ---------------- UTILS ---------------- */
  const isISODate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

  const toISODateOnly = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const getBaseDate = () => {
    if (isISODate(selectedDay)) return new Date(`${selectedDay}T00:00:00`);
    return new Date();
  };

  const getDayKeyFromSelectedDay = () => {
    if (!selectedDay) return "lundi";
    if (!isISODate(selectedDay)) return selectedDay;
    const d = new Date(`${selectedDay}T00:00:00`);
    return ORDER[d.getDay() === 0 ? 6 : d.getDay() - 1];
  };

  const getDateForDay = (base: Date, day: string) => {
    const d = new Date(base);
    const target = DAY_INDEX[day];
    const diff = target - d.getDay();
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const splitInterval = (start: string, end: string) => {
    const res: string[] = [];
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;

    while (cur < endMin) {
      const h = String(Math.floor(cur / 60)).padStart(2, "0");
      const m = String(cur % 60).padStart(2, "0");
      res.push(`${h}:${m}`);
      cur += 15;
    }
    return res;
  };

  /* ---------------- ACTIONS UI ---------------- */
  const addSlot = (day: string) => {
    const s = newStart[day];
    const e = newEnd[day];

    // on garde ta logique: on n'ajoute que si format HH:MM complet
    if (!s || !e || s.length !== 5 || e.length !== 5) return;

    setLocalHoraires((prev: any) => ({
      ...prev,
      [day]: [...(prev[day] || []), `${s}-${e}`],
    }));

    setNewStart((p) => ({ ...p, [day]: "" }));
    setNewEnd((p) => ({ ...p, [day]: "" }));

    // UX identique: après ajout, focus sur début
    setTimeout(() => startRefs.current[day]?.focus(), 50);
  };

  const removeSlot = (day: string, idx: number) => {
    setLocalHoraires((prev: any) => ({
      ...prev,
      [day]: prev[day].filter((_: any, i: number) => i !== idx),
    }));
  };

  const setDayOff = (day: string) => {
    setLocalHoraires((prev: any) => ({ ...prev, [day]: [] }));
  };

  const setWeekOff = () => {
    const cleared: any = {};
    ORDER.forEach((d) => (cleared[d] = []));
    setLocalHoraires(cleared);
  };

  /* ---------------- SAVE (jour + semaine) ---------------- */
  const save = async () => {
    if (!medecinId || !selectedDay) return;

    setSaving(true);

    try {
      const baseDate = getBaseDate();

      if (mode === "day") {
        const dayKey = getDayKeyFromSelectedDay();
        const intervals = localHoraires[dayKey] || [];
        const date = toISODateOnly(baseDate);

        for (const interval of intervals) {
          const [start, end] = interval.split("-");
          for (const heure of splitInterval(start, end)) {
            await fetch("http://localhost:3001/rdv/slot", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                medecinId,
                date,
                heure,
                typeSlot: "LIBRE",
              }),
            });
          }
        }
      }

      if (mode === "week") {
        for (const day of ORDER) {
          const intervals = localHoraires[day] || [];
          const date = toISODateOnly(getDateForDay(baseDate, day));

          for (const interval of intervals) {
            const [start, end] = interval.split("-");
            for (const heure of splitInterval(start, end)) {
              await fetch("http://localhost:3001/rdv/slot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  medecinId,
                  date,
                  heure,
                  typeSlot: "LIBRE",
                }),
              });
            }
          }
        }
      }

      setSaving(false);
      onClose(true);
    } catch (e) {
      console.error(e);
      setSaving(false);
      onClose(false);
    }
  };

  /* ---------------- RENDER DAY ---------------- */
  const renderDay = (day: string) => (
    <div
      key={day}
      className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-xl"
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold capitalize text-white">{day}</h3>

        <button
          onClick={() => setDayOff(day)}
          className="px-4 py-2 rounded-lg border border-red-500 text-red-300 hover:bg-red-600 hover:text-white transition font-semibold"
        >
          Mettre en congé
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {(localHoraires[day] || []).map((slot: string, idx: number) => (
          <div
            key={idx}
            className="flex justify-between items-center bg-slate-700 p-2 rounded-lg"
          >
            <span className="text-white">{slot}</span>

            <button
              onClick={() => removeSlot(day, idx)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash size={16} />
            </button>
          </div>
        ))}

        {(localHoraires[day] || []).length === 0 && (
          <p className="text-slate-400 italic text-sm">Aucun horaire</p>
        )}
      </div>

      <div className="flex gap-2 items-center">
        {/* ✅ Début: auto-focus vers fin quand 4 chiffres tapés */}
        <TimeField
          value={newStart[day] || ""}
          onChange={(v) => setNewStart((p) => ({ ...p, [day]: v }))}
          ref={(el) => (startRefs.current[day] = el)}
          onComplete={() => endRefs.current[day]?.focus()}
          onEnter={() => endRefs.current[day]?.focus()}
        />

        {/* ✅ Fin: à 4 chiffres => addSlot() (TimeField attend 50ms avant onComplete) */}
        <TimeField
          value={newEnd[day] || ""}
          onChange={(v) => setNewEnd((p) => ({ ...p, [day]: v }))}
          ref={(el) => (endRefs.current[day] = el)}
          onComplete={() => addSlot(day)}
          onEnter={() => addSlot(day)}
        />

        <button
          onClick={() => addSlot(day)}
          className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 rounded-lg font-semibold"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[9999]">
      <div className="bg-slate-900 rounded-2xl p-10 w-[80%] h-[80%] overflow-auto border border-slate-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-emerald-400">
            {mode === "week"
              ? "Horaires de la semaine"
              : `Horaires du ${selectedDay}`}
          </h2>

          <div className="flex gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 rounded-lg font-bold"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>

            <button
              onClick={() => onClose()}
              className="text-slate-300 text-xl"
            >
              ✕
            </button>
          </div>
        </div>

        {mode === "week" && (
          <div className="flex justify-center mb-8">
            <button
              onClick={setWeekOff}
              className="bg-red-500 hover:bg-red-400 text-white font-bold px-8 py-3 rounded-xl"
            >
              Mettre toute la semaine en congé
            </button>
          </div>
        )}

        {mode === "week" ? (
          <div className="grid grid-cols-2 gap-6">
            {ORDER.map((day) =>
              day === "dimanche" ? (
                <div key={day} className="col-span-2 flex justify-center">
                  <div className="w-1/2">{renderDay(day)}</div>
                </div>
              ) : (
                renderDay(day)
              )
            )}
          </div>
        ) : (
          <div className="max-w-xl mx-auto">
            {renderDay(getDayKeyFromSelectedDay())}
          </div>
        )}
      </div>
    </div>
  );
}
