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

type SlotMode = "VIERGE" | "LIBRE" | "BLOQUE";

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
  source: "REAL" | "VIRTUEL";
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
 * ISO : lundi=1 ... dimanche=7
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

const minutesToTime = (mins: number) => {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
};

const addMinutesToTime = (t: string, delta: number) => {
  const mins = timeToMinutes(t);
  return minutesToTime(mins + delta);
};

/**
 * groupDaySlots produit end = dernière cellule (ex: 10:45).
 * Pour appliquer un intervalle [start, end) à la quarter, il faut end+15.
 */
const endExclusiveFromGroupedEnd = (groupedEnd: string) =>
  addMinutesToTime(groupedEnd, 15);

const inRange0700to2300 = (heure: string) => {
  const min = timeToMinutes(heure);
  return min >= 7 * 60 && min <= 23 * 60;
};

/**
 * ✅ FIX : propagation du "source"
 * - si un intervalle (LIBRE/BLOQUE) contient au moins un slot REAL, l’intervalle devient REAL
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
        source: "REAL",
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
      if (s.source === "REAL") current.source = "REAL";
    } else {
      if (current) res.push(current);
      current = {
        start: s.heure,
        end: s.heure,
        typeSlot: s.typeSlot,
        rdvIds: s.rdvId ? [s.rdvId] : [],
        source: s.source,
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

  // ✅ mode de création (LIBRE par défaut)
  const [slotMode, setSlotMode] = useState<SlotMode>("LIBRE");

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

  // (laissé inchangé, utilisé ailleurs potentiellement)
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

  /**
   * ✅ MODIF 1 (FRONT) — Interprétation intelligente des VIRTUEL
   * - VIRTUEL + dans horaires => LIBRE (affiché)
   * - VIRTUEL + hors horaires => pas de créneau (filtré)
   */
  const isInDefinedHoraires = useCallback(
    (day: string, heure: string) => {
      const intervals: string[] = localHoraires?.[day] || [];
      if (!intervals.length) return false;

      const t = timeToMinutes(heure);

      for (const interval of intervals) {
        if (!interval || typeof interval !== "string") continue;
        const [start, end] = interval.split("-");
        if (!start || !end) continue;

        const s = timeToMinutes(start);
        const e = timeToMinutes(end);

        if (t >= s && t < e) return true;
      }
      return false;
    },
    [localHoraires]
  );

  const normalizeSlotsForDisplay = useCallback(
    (day: string, slots: DaySlot[]) => {
      return (slots || [])
        .filter((s) => s?.heure && inRange0700to2300(s.heure))
        .filter((s) => {
          if (s.source !== "VIRTUEL") return true;
          return isInDefinedHoraires(day, s.heure);
        })
        .map((s) => {
          if (s.source === "VIRTUEL") {
            return { ...s, typeSlot: "LIBRE" as const };
          }
          return s;
        });
    },
    [isInDefinedHoraires]
  );

  /* ---------------- LOADERS ---------------- */
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

  useEffect(() => {
    if (mode !== "day") return;
    loadDay();
  }, [mode, loadDay]);

  useEffect(() => {
    if (mode !== "week") return;
    loadWeek();
  }, [mode, loadWeek]);

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
   * ✅ CORE — VIERGE (HARD DELETE) via schedule/apply
   * IMPORTANT: le backend attend start/end (sinon no-op).
   */
  const applyDeleteOnlyInterval = async (params: {
    date: string;
    start: string;
    end: string;
  }) => {
    const { date, start, end } = params;
    if (!medecinId) return;

    await fetch("http://localhost:3001/rdv/schedule/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medecinId,
        date,
        start,
        end,
        deleteOnly: true,
      }),
    });
  };

  /**
   * ✅ FIX CONGÉ: journée entière = VIERGE sur 07:00-23:00
   */
  const applyDayDeleteOnly = async (dateIso: string) => {
    await applyDeleteOnlyInterval({
      date: dateIso,
      start: "07:00",
      end: "23:00",
    });
  };

  /**
   * ✅ FIX POUBELLE: intervalle groupé = VIERGE (deleteOnly)
   * - end doit être exclusif => end+15
   */
  const handleTrashInterval = async (params: {
    dateIso: string;
    start: string;
    endGrouped: string;
  }) => {
    const { dateIso, start, endGrouped } = params;

    setSaving(true);
    try {
      await applyDeleteOnlyInterval({
        date: dateIso,
        start,
        end: endExclusiveFromGroupedEnd(endGrouped),
      });

      if (mode === "week") await loadWeek();
      if (mode === "day") await loadDay();

      onClose(true);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  /**
   * ✅ FIX "Mettre en congé": VIERGE réel (deleteOnly journée)
   */
  const handleDayOff = async (day: string) => {
    // 1) UI existante (vider horaires locaux)
    setDayOff(day);

    // 2) Congé réel (VIERGE): hard delete journée
    setSaving(true);
    try {
      const baseDate = getBaseDate();
      const dateIso =
        mode === "week"
          ? toISODateOnly(getDateForDay(baseDate, day))
          : selectedDay || toISODateOnly(baseDate);

      await applyDayDeleteOnly(dateIso);

      if (mode === "week") await loadWeek();
      if (mode === "day") await loadDay();

      onClose(true);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  /**
   * ✅ FIX "Mettre toute la semaine en congé": VIERGE réel (deleteOnly jour par jour)
   */
  const handleWeekOff = async () => {
    setWeekOff();

    setSaving(true);
    try {
      const baseDate = getBaseDate();

      for (const day of ORDER) {
        const dateIso = toISODateOnly(getDateForDay(baseDate, day));
        await applyDayDeleteOnly(dateIso);
      }

      await loadWeek();
      onClose(true);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  /* ---------------- SAVE (inchangé sauf logique existante) ---------------- */
  const save = async () => {
    if (!medecinId || !selectedDay) return;

    setSaving(true);
    try {
      const baseDate = getBaseDate();

      /**
       * POST /rdv/schedule/apply { medecinId, date, start, end, typeSlot? / deleteOnly? }
       * - VIERGE => deleteOnly + intervalle
       * - LIBRE/BLOQUE => typeSlot
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
              ...(slotMode === "VIERGE"
                ? { deleteOnly: true }
                : { typeSlot: slotMode }),
            }),
          });
        }

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
                ...(slotMode === "VIERGE"
                  ? { deleteOnly: true }
                  : { typeSlot: slotMode }),
              }),
            });
          }
        }

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

    const slotsForThisCardRaw =
      mode === "week" ? weekSlots[dateIso] || [] : daySlots;

    const slotsForThisCard = normalizeSlotsForDisplay(day, slotsForThisCardRaw);
    const loadingSlots = mode === "week" ? loadingWeek : loadingDay;

    return (
      <div
        key={day}
        className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-xl"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold capitalize text-white">{day}</h3>

          <button
            onClick={() => handleDayOff(day)}
            className="px-4 py-2 rounded-lg border border-red-500 text-red-300 hover:bg-red-600 hover:text-white transition font-semibold"
            disabled={saving}
          >
            Mettre en congé
          </button>
        </div>

        {/* 🎯 SLOTS RÉELS — même UI, mais poubelle = VIERGE (deleteOnly) */}
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
                      onClick={() =>
                        handleTrashInterval({
                          dateIso,
                          start: s.start,
                          endGrouped: s.end,
                        })
                      }
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
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold text-emerald-400">
              {mode === "week"
                ? "Horaires de la semaine"
                : `Horaires du ${selectedDay}`}
            </h2>

            {/* ✅ UI inchangée : choix VIERGE / LIBRE / BLOQUE */}
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-slate-200 font-semibold">
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === "VIERGE"}
                  onChange={() => setSlotMode("VIERGE")}
                />
                Vierge
              </label>

              <label className="flex items-center gap-2 text-slate-200 font-semibold">
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === "LIBRE"}
                  onChange={() => setSlotMode("LIBRE")}
                />
                Libre
              </label>

              <label className="flex items-center gap-2 text-slate-200 font-semibold">
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === "BLOQUE"}
                  onChange={() => setSlotMode("BLOQUE")}
                />
                Bloqué
              </label>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-3 rounded-lg font-bold"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>

            <button onClick={() => onClose()} className="text-slate-300 text-xl">
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
