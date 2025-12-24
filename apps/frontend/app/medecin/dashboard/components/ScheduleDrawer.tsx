"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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

type DaySlot = {
  heure: string;
  typeSlot: "LIBRE" | "PRIS" | "BLOQUE";
  rdvId: number | null;
  label?: string;
  source: "REAL" | "VIRTUEL";
};

type DisplaySlot = {
  start: string;
  end: string;
  typeSlot: "LIBRE" | "PRIS" | "BLOQUE";
  rdvIds: number[];
  source: "REAL" | "VIRTUEL"; // ✅ AJOUT : permet d’éviter les “fantômes” (REAL gagne)
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

/**
 * ✅ FIX SEMAINE (DIMANCHE)
 * On bascule DAY_INDEX en logique ISO (lundi=1 ... dimanche=7)
 * car Date.getDay() retourne 0 pour dimanche.
 *
 * IMPORTANT : même nom (DAY_INDEX), rien supprimé, mais valeurs corrigées.
 */
const DAY_INDEX: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
};

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const inRange0700to2300 = (heure: string) => {
  const min = timeToMinutes(heure);
  return min >= 7 * 60 && min <= 23 * 60;
};

/**
 * ✅ FIX : propagation du "source"
 * - si un intervalle (LIBRE/BLOQUE) contient au moins un slot REAL, l’intervalle devient REAL
 * - évite les rendus "Libre" visuellement incohérents lorsque VIRTUEL et REAL se mélangent
 */
const groupDaySlots = (slots: DaySlot[]): DisplaySlot[] => {
  const filtered = (slots || [])
    .filter((s) => s?.heure && inRange0700to2300(s.heure))
    .sort((a, b) => timeToMinutes(a.heure) - timeToMinutes(b.heure));

  const res: DisplaySlot[] = [];
  let current: DisplaySlot | null = null;

  for (const s of filtered) {
    if (s.typeSlot === "PRIS") {
      if (current) {
        res.push(current);
        current = null;
      }
      res.push({
        start: s.heure,
        end: s.heure,
        typeSlot: "PRIS",
        rdvIds: s.rdvId ? [s.rdvId] : [],
        source: "REAL", // ✅ PRIS = réel (et évite les styles fantômes)
      });
      continue;
    }

    if (
      current &&
      current.typeSlot === s.typeSlot &&
      timeToMinutes(s.heure) === timeToMinutes(current.end) + 15
    ) {
      current.end = s.heure;
      if (s.rdvId) current.rdvIds.push(s.rdvId);

      // ✅ FIX : si l’un des slots groupés est REAL, l’intervalle devient REAL
      if (s.source === "REAL") {
        current.source = "REAL";
      }
    } else {
      if (current) res.push(current);
      current = {
        start: s.heure,
        end: s.heure,
        typeSlot: s.typeSlot,
        rdvIds: s.rdvId ? [s.rdvId] : [],
        source: s.source, // ✅ AJOUT : base sur la première cellule du groupe
      };
    }
  }

  if (current) res.push(current);
  return res;
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
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [weekSlots, setWeekSlots] = useState<Record<string, DaySlot[]>>({});
  const [saving, setSaving] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingWeek, setLoadingWeek] = useState(false);

  const [newStart, setNewStart] = useState<Record<string, string>>({});
  const [newEnd, setNewEnd] = useState<Record<string, string>>({});

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

  /**
   * ✅ FIX DIMANCHE (ISO WEEK)
   * - JS: getDay() -> 0 (dimanche) ... 6 (samedi)
   * - ISO: 1 (lundi) ... 7 (dimanche)
   *
   * On convertit d.getDay() en "isoDay" puis on calcule diff.
   * => dimanches inclus correctement en vue semaine (loadWeek + save + rendu)
   */
  const getDateForDay = (base: Date, day: string) => {
    const d = new Date(base);
    const targetIso = DAY_INDEX[day]; // 1..7
    const jsDay = d.getDay(); // 0..6
    const isoDay = jsDay === 0 ? 7 : jsDay; // 1..7

    const diff = targetIso - isoDay;

    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // ✅ IMPORTANT : on garde splitInterval dans le scope du composant (inchangé)
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

  /* ---------------- LOADERS (micro-ajout pour éviter stale state) ---------------- */
  const loadDay = useCallback(async () => {
    if (
      !open ||
      !medecinId ||
      !selectedDay ||
      !/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)
    ) {
      setDaySlots([]);
      return;
    }

    setLoadingDay(true);
    try {
      const res = await fetch(
        `http://localhost:3001/rdv/medecin/${medecinId}/day?date=${selectedDay}`
      );
      const json = await res.json();
      setDaySlots(json.slots || []);
    } catch (e) {
      console.error(e);
      setDaySlots([]);
    } finally {
      setLoadingDay(false);
    }
  }, [open, medecinId, selectedDay]);

  const loadWeek = useCallback(async () => {
    if (
      !open ||
      !medecinId ||
      !selectedDay ||
      !/^\d{4}-\d{2}-\d{2}$/.test(selectedDay)
    ) {
      setWeekSlots({});
      return;
    }

    setLoadingWeek(true);
    try {
      const baseDate = getBaseDate();
      const map: Record<string, DaySlot[]> = {};

      // mêmes dates que save() en semaine
      for (const day of ORDER) {
        const dateIso = toISODateOnly(getDateForDay(baseDate, day));

        try {
          const res = await fetch(
            `http://localhost:3001/rdv/medecin/${medecinId}/day?date=${dateIso}`
          );
          const json = await res.json();
          map[dateIso] = json.slots || [];
        } catch (e) {
          console.error(e);
          map[dateIso] = [];
        }
      }

      setWeekSlots(map);
    } finally {
      setLoadingWeek(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, medecinId, selectedDay]);

  /* ---------------- LOAD DAY SLOTS (inchangé, mais appelle loadDay) ---------------- */
  useEffect(() => {
    if (mode !== "day") return;
    loadDay();
  }, [mode, loadDay]);

  /* ---------------- LOAD WEEK SLOTS (inchangé, mais appelle loadWeek) ---------------- */
  useEffect(() => {
    if (mode !== "week") return;
    loadWeek();
  }, [mode, loadWeek]);

  /* ---------------- DAY SLOT ACTION ---------------- */
  const setSlotsHors = async (rdvIds: number[]) => {
    const ids = (rdvIds || []).filter((x): x is number => typeof x === "number");
    if (!ids.length) return;

    setSaving(true);
    try {
      for (const id of ids) {
        await fetch(`http://localhost:3001/rdv/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typeSlot: "HORS" }),
        });
      }

      // ✅ micro-fix : éviter l’état stale (surtout en semaine)
      if (mode === "week") await loadWeek();
      if (mode === "day") await loadDay();

      onClose(true);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  /* ---------------- ACTIONS UI EXISTANTES ---------------- */
  const addSlot = (day: string) => {
    const s = newStart[day];
    const e = newEnd[day];
    if (!s || !e || s.length !== 5 || e.length !== 5) return;

    setLocalHoraires((prev: any) => ({
      ...prev,
      [day]: [...(prev[day] || []), `${s}-${e}`],
    }));

    setNewStart((p) => ({ ...p, [day]: "" }));
    setNewEnd((p) => ({ ...p, [day]: "" }));

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

  /**
   * ✅ NOUVEAU (sans supprimer l’existant)
   * Mettre en congé "réel" = passer les slots existants (REAL) en HORS,
   * tout en gardant le comportement UI existant (vider localHoraires).
   */
  const handleDayOff = async (day: string, slotsForThisCard: DaySlot[]) => {
    // 1) UI existante (horaires locaux)
    setDayOff(day);

    // 2) Congé réel : on met en HORS tous les RDV présents sur la journée
    const grouped = groupDaySlots(slotsForThisCard);
    const allRdvIds = grouped.flatMap((s) => s.rdvIds || []);
    await setSlotsHors(allRdvIds);
  };

  /**
   * ✅ NOUVEAU (sans supprimer l’existant)
   * Mettre toute la semaine en congé : idem, mais sur tous les jours chargés en weekSlots.
   */
  const handleWeekOff = async () => {
    // 1) UI existante
    setWeekOff();

    // 2) Congé réel : prendre tous les rdvIds de toute la semaine (issus des GET /day)
    const allIds: number[] = [];
    for (const dateIso of Object.keys(weekSlots || {})) {
      const grouped = groupDaySlots(weekSlots[dateIso] || []);
      for (const s of grouped) {
        if (s?.rdvIds?.length) allIds.push(...s.rdvIds);
      }
    }

    await setSlotsHors(allIds);
  };

  /* ---------------- SAVE (même logique, micro-fix refresh) ---------------- */
  const save = async () => {
    if (!medecinId || !selectedDay) return;

    setSaving(true);
    try {
      const baseDate = getBaseDate();

      /**
       * ✅ MINI-CHANGEMENT CRITIQUE :
       * On ne spam plus POST /rdv/slot pour chaque quart d’heure.
       * On appelle le backend transactionnel :
       * POST /rdv/schedule/apply { medecinId, date, start, end }
       *
       * => overwrite propre dans l’intervalle
       * => plus de slots fantômes / incohérences
       */
      if (mode === "day") {
        const dayKey = getDayKeyFromSelectedDay();
        const intervals = localHoraires[dayKey] || [];
        const date = toISODateOnly(baseDate);

        for (const interval of intervals) {
          const [start, end] = interval.split("-");

          await fetch("http://localhost:3001/rdv/schedule/apply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              medecinId,
              date,
              start,
              end,
            }),
          });
        }

        // ✅ micro-fix : refresh local daySlots avant fermeture
        await loadDay();
      }

      if (mode === "week") {
        for (const day of ORDER) {
          const intervals = localHoraires[day] || [];
          const date = toISODateOnly(getDateForDay(baseDate, day));

          for (const interval of intervals) {
            const [start, end] = interval.split("-");

            await fetch("http://localhost:3001/rdv/schedule/apply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                medecinId,
                date,
                start,
                end,
              }),
            });
          }
        }

        // ✅ micro-fix : refresh local weekSlots avant fermeture
        await loadWeek();
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
  const renderDay = (day: string) => {
    const baseDate = getBaseDate();

    const dateIso =
      mode === "week"
        ? toISODateOnly(getDateForDay(baseDate, day))
        : selectedDay || "";

    const slotsForThisCard =
      mode === "week" ? weekSlots[dateIso] || [] : daySlots;

    const loadingSlots = mode === "week" ? loadingWeek : loadingDay;

    return (
      <div
        key={day}
        className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-xl"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold capitalize text-white">{day}</h3>

          <button
            onClick={() => handleDayOff(day, slotsForThisCard)}
            className="px-4 py-2 rounded-lg border border-red-500 text-red-300 hover:bg-red-600 hover:text-white transition font-semibold"
            disabled={saving}
          >
            Mettre en congé
          </button>
        </div>

        {/* 🎯 SLOTS RÉELS — MÊME DA QU’AVANT (jour + semaine) */}
        <div className="space-y-2 mb-4">
          {loadingSlots && (
            <p className="text-slate-400 italic text-sm">Chargement…</p>
          )}

          {!loadingSlots &&
            groupDaySlots(slotsForThisCard).map((s, idx) => (
              <div
                key={`${s.start}-${s.end}-${s.typeSlot}-${idx}`}
                className="flex justify-between items-center bg-slate-700 p-2 rounded-lg"
              >
                <span className="text-white font-mono">
                  {s.start}
                  {s.end !== s.start ? `-${s.end}` : ""}
                </span>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 uppercase">
                    {s.typeSlot}
                  </span>

                  {s.typeSlot !== "PRIS" && (
                    <button
                      onClick={() => setSlotsHors(s.rdvIds)}
                      className="text-red-400 hover:text-red-300"
                      disabled={saving}
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* ⬇️ EXISTANT — ÉDITION HORAIRES */}
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
          <TimeField
            value={newStart[day] || ""}
            onChange={(v) => setNewStart((p) => ({ ...p, [day]: v }))}
            ref={(el) => (startRefs.current[day] = el)}
            onComplete={() => endRefs.current[day]?.focus()}
            onEnter={() => endRefs.current[day]?.focus()}
          />

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
  };

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
              onClick={handleWeekOff}
              className="bg-red-500 hover:bg-red-400 text-white font-bold px-8 py-3 rounded-xl"
              disabled={saving}
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
