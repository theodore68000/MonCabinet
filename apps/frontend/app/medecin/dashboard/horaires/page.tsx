"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import TimeField from "../components/TimeField";
import { Trash, Plus } from "lucide-react";

/* -------------------------------------------------------
   CONSTANTES
---------------------------------------------------------*/
const ORDER = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
];

/* -------------------------------------------------------
   HELPERS (IDENTIQUES ScheduleDrawer)
---------------------------------------------------------*/
const toMinutes = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
};

const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(
    2,
    "0"
  )}`;

const splitInterval = (start: string, end: string) => {
  const res: string[] = [];
  let cur = toMinutes(start);
  const endMin = toMinutes(end);
  while (cur < endMin) {
    res.push(toHHMM(cur));
    cur += 15;
  }
  return res;
};

const slotsToIntervals = (slots: string[]) => {
  if (!Array.isArray(slots) || slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => toMinutes(a) - toMinutes(b));
  const res: string[] = [];

  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i]) === toMinutes(prev) + 15) {
      prev = sorted[i];
    } else {
      res.push(`${start}-${toHHMM(toMinutes(prev) + 15)}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }

  res.push(`${start}-${toHHMM(toMinutes(prev) + 15)}`);
  return res;
};

/* -------------------------------------------------------
   COMPONENT
---------------------------------------------------------*/
export default function HorairesReferencePage() {
  const router = useRouter();

  const [medecin, setMedecin] = useState<any>(null);
  const [localHoraires, setLocalHoraires] = useState<Record<string, string[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newStart, setNewStart] = useState<any>({});
  const [newEnd, setNewEnd] = useState<any>({});

  const startRefs = useRef<any>({});
  const endRefs = useRef<any>({});

  /* -------------------------------------------------------
     LOAD
  ---------------------------------------------------------*/
  useEffect(() => {
    const fetchMed = async () => {
      const res = await fetch("http://localhost:3001/medecin/me");
      const data = await res.json();
      setMedecin(data);

      let raw = data?.horairesReference ?? data?.horaires ?? {};

      // ✅ NORMALISATION ULTRA SAFE
      const normalized: any = {};
      ORDER.forEach((d) => {
        const arr = Array.isArray(raw[d]) ? raw[d] : [];
        normalized[d] = arr.some((v: string) => v.includes("-"))
          ? arr
          : slotsToIntervals(arr);
      });

      setLocalHoraires(normalized);
      setLoading(false);
    };

    fetchMed();
  }, []);

  /* -------------------------------------------------------
     SAVE
  ---------------------------------------------------------*/
  const save = async () => {
    setSaving(true);
    await fetch(`http://localhost:3001/medecin/${medecin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ horairesReference: localHoraires }),
    });
    setSaving(false);
  };

  /* -------------------------------------------------------
     ADD SLOT
  ---------------------------------------------------------*/
  const addSlot = (day: string) => {
    const s = newStart[day];
    const e = newEnd[day];
    if (!s || !e || s.length !== 5 || e.length !== 5) return;

    setLocalHoraires((p) => ({
      ...p,
      [day]: [...(p[day] || []), `${s}-${e}`],
    }));

    setNewStart((p: any) => ({ ...p, [day]: "" }));
    setNewEnd((p: any) => ({ ...p, [day]: "" }));

    setTimeout(() => startRefs.current[day]?.focus(), 50);
  };

  /* -------------------------------------------------------
     RENDER DAY
  ---------------------------------------------------------*/
  const renderDay = (day: string) => (
    <div key={day} className="bg-slate-800 p-5 rounded-xl border border-slate-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold capitalize">{day}</h3>

        <button
          className="text-red-400 text-sm"
          onClick={() =>
            setLocalHoraires((p) => ({
              ...p,
              [day]: [],
            }))
          }
        >
          Mettre en congé
        </button>
      </div>

      {/* EXISTING */}
      <div className="space-y-2 mb-3">
        {(localHoraires[day] || []).map((slot, i) => (
          <div
            key={i}
            className="flex justify-between bg-slate-700 p-2 rounded-lg"
          >
            <span>{slot}</span>
            <button
              className="text-red-300"
              onClick={() =>
                setLocalHoraires((p) => ({
                  ...p,
                  [day]: p[day].filter((_, idx) => idx !== i),
                }))
              }
            >
              <Trash size={16} />
            </button>
          </div>
        ))}

        {(localHoraires[day] || []).length === 0 && (
          <p className="text-slate-400 italic text-sm">Aucun horaire</p>
        )}
      </div>

      {/* ADD */}
      <div className="flex gap-2 items-center">
        <TimeField
          value={newStart[day] || ""}
          onChange={(v) => setNewStart((p: any) => ({ ...p, [day]: v }))}
          ref={(el) => (startRefs.current[day] = el)}
          onComplete={() => endRefs.current[day]?.focus()}
        />

        <TimeField
          value={newEnd[day] || ""}
          onChange={(v) => setNewEnd((p: any) => ({ ...p, [day]: v }))}
          ref={(el) => (endRefs.current[day] = el)}
          onComplete={() => addSlot(day)}
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

  /* -------------------------------------------------------
     RENDER
  ---------------------------------------------------------*/
  return (
    <div className="flex bg-slate-950 min-h-screen text-white">
      <Sidebar />

      <div className="flex-1 p-10 max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/medecin/dashboard")}
          className="mb-6 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700 transition"
        >
          ← Retour au dashboard
        </button>

        <h1 className="text-2xl font-bold mb-6 text-emerald-400">
          Mes horaires de référence
        </h1>

        {loading ? (
          <p>Chargement...</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {ORDER.map((d) =>
              d === "dimanche" ? (
                <div key={d} className="col-span-2 flex justify-center">
                  <div className="w-1/2">{renderDay(d)}</div>
                </div>
              ) : (
                renderDay(d)
              )
            )}
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={save}
            className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
