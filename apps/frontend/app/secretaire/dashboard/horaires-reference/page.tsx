"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import SidebarSecretaire from "../components/Sidebar";
import TimeField from "../../../medecin/dashboard/components/TimeField";

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
] as const;

type DayKey = (typeof ORDER)[number];

/* -------------------------------------------------------
   HELPERS TEMPS
---------------------------------------------------------*/
const toMinutes = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
};

const normalizeIntervals = (arr: string[]) => {
  const valid: string[] = [];

  for (const it of arr || []) {
    const m = it.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) continue;

    const s = toMinutes(m[1]);
    const e = toMinutes(m[2]);
    if (e <= s) continue;
    if (s % 15 !== 0 || e % 15 !== 0) continue;

    valid.push(`${m[1]}-${m[2]}`);
  }

  return Array.from(new Set(valid)).sort(
    (a, b) => toMinutes(a) - toMinutes(b)
  );
};

const isValidTime = (t: string) => /^\d{2}:\d{2}$/.test(t);
const isQuarter = (t: string) => toMinutes(t) % 15 === 0;

/* -------------------------------------------------------
   API
---------------------------------------------------------*/
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

const apiFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, { ...options, credentials: "include" });

/* -------------------------------------------------------
   COMPONENT
---------------------------------------------------------*/
export default function HorairesReferenceSecretairePage() {
  const router = useRouter();

  const [secretaire, setSecretaire] = useState<any>(null);
  const [medecins, setMedecins] = useState<any[]>([]);
  const [selectedMedecinId, setSelectedMedecinId] = useState<number | null>(null);
  const [medecin, setMedecin] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const [localHoraires, setLocalHoraires] = useState<Record<DayKey, string[]>>({
    lundi: [],
    mardi: [],
    mercredi: [],
    jeudi: [],
    vendredi: [],
    samedi: [],
    dimanche: [],
  });

  const [newStart, setNewStart] = useState<Record<string, string>>({});
  const [newEnd, setNewEnd] = useState<Record<string, string>>({});

  const startRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const endRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* -------------------------------------------------------
     LOAD SESSION + MÉDECINS CABINET
  ---------------------------------------------------------*/
  useEffect(() => {
    const load = async () => {
      try {
        const raw = localStorage.getItem("secretaireSession");
        if (!raw) {
          router.push("/secretaire/login");
          return;
        }

        const session = JSON.parse(raw);
        setSecretaire(session);

        const res = await apiFetch(
          `${API_BASE}/secretaire/${session.id}/medecins`
        );
        const data = await res.json();

        setMedecins(data?.medecins || []);
      } catch {
        setError("Impossible de charger les médecins du cabinet.");
      }
    };

    load();
  }, [router]);

  /* -------------------------------------------------------
     LOAD MÉDECIN SÉLECTIONNÉ
  ---------------------------------------------------------*/
  useEffect(() => {
    if (!selectedMedecinId) return;

    const loadMedecin = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await apiFetch(
          `${API_BASE}/medecin/${selectedMedecinId}`
        );
        if (!res.ok) throw new Error();

        const data = await res.json();
        setMedecin(data);

        const raw = data?.horairesReference || {};

        const normalized: Record<DayKey, string[]> = {
          lundi: [],
          mardi: [],
          mercredi: [],
          jeudi: [],
          vendredi: [],
          samedi: [],
          dimanche: [],
        };

        ORDER.forEach((d) => {
          normalized[d] = normalizeIntervals(raw[d] || []);
        });

        setLocalHoraires(normalized);
      } catch {
        setError("Erreur chargement médecin.");
      } finally {
        setLoading(false);
      }
    };

    loadMedecin();
  }, [selectedMedecinId]);

  /* -------------------------------------------------------
     SAVE
  ---------------------------------------------------------*/
  const save = async () => {
    if (!medecin?.id) return;

    setSaving(true);
    setError(null);
    setSavedOk(false);

    try {
      const payload = ORDER.reduce((acc, d) => {
        acc[d] = normalizeIntervals(localHoraires[d]);
        return acc;
      }, {} as Record<DayKey, string[]>);

      const res = await apiFetch(
        `${API_BASE}/schedule-reference/${medecin.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ horairesReference: payload }),
        }
      );

      if (!res.ok) throw new Error();

      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch {
      setError("Erreur lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------
     UI HELPERS
  ---------------------------------------------------------*/
  const addSlot = (day: DayKey) => {
    const s = newStart[day];
    const e = newEnd[day];

    if (!isValidTime(s) || !isValidTime(e)) return;
    if (!isQuarter(s) || !isQuarter(e)) return;
    if (toMinutes(e) <= toMinutes(s)) return;

    setLocalHoraires((p) => ({
      ...p,
      [day]: normalizeIntervals([...(p[day] || []), `${s}-${e}`]),
    }));

    setNewStart((p) => ({ ...p, [day]: "" }));
    setNewEnd((p) => ({ ...p, [day]: "" }));

    setTimeout(() => startRefs.current[day]?.focus(), 50);
  };

  const removeSlot = (day: DayKey, idx: number) => {
    setLocalHoraires((p) => ({
      ...p,
      [day]: p[day].filter((_, i) => i !== idx),
    }));
  };

  /* -------------------------------------------------------
     RENDER
  ---------------------------------------------------------*/
  return (
    <div className="flex bg-slate-950 min-h-screen text-white">
      <SidebarSecretaire />

      <div className="flex-1 p-10 max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/secretaire/dashboard")}
          className="mb-6 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700"
        >
          ← Retour au planning
        </button>

        <h1 className="text-2xl font-bold mb-6 text-emerald-400">
          Horaires de référence
        </h1>

        {/* SELECT MÉDECIN */}
        <div className="mb-8">
          <label className="block mb-2 text-sm text-slate-300">
            Médecin du cabinet
          </label>
          <select
            value={selectedMedecinId ?? ""}
            onChange={(e) =>
              setSelectedMedecinId(
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="bg-slate-900 border border-slate-700 rounded px-4 py-2 w-full max-w-md"
          >
            <option value="">— Sélectionner un médecin —</option>
            {medecins.map((m) => (
              <option key={m.id} value={m.id}>
                Dr {m.prenom} {m.nom}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-700 p-3 rounded">
            {error}
          </div>
        )}

        {savedOk && (
          <div className="mb-6 bg-emerald-900/30 border border-emerald-700 p-3 rounded">
            Horaires enregistrés et créneaux générés.
          </div>
        )}

        {!selectedMedecinId ? (
          <p className="text-slate-400 italic">
            Sélectionne un médecin pour configurer ses horaires.
          </p>
        ) : loading ? (
          <p>Chargement…</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {ORDER.map((d) => (
              <div
                key={d}
                className="bg-slate-800 p-5 rounded-xl border border-slate-700"
              >
                <h3 className="font-semibold capitalize mb-3">{d}</h3>

                {(localHoraires[d] || []).map((slot, i) => (
                  <div
                    key={i}
                    className="flex justify-between bg-slate-700 p-2 rounded mb-2"
                  >
                    <span>{slot}</span>
                    <button onClick={() => removeSlot(d, i)}>
                      <Trash size={16} />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 mt-2">
                  <TimeField
                    value={newStart[d] || ""}
                    onChange={(v) =>
                      setNewStart((p) => ({ ...p, [d]: v }))
                    }
                    ref={(el) => (startRefs.current[d] = el)}
                    onComplete={() => endRefs.current[d]?.focus()}
                  />
                  <TimeField
                    value={newEnd[d] || ""}
                    onChange={(v) =>
                      setNewEnd((p) => ({ ...p, [d]: v }))
                    }
                    ref={(el) => (endRefs.current[d] = el)}
                    onComplete={() => addSlot(d)}
                  />
                  <button
                    onClick={() => addSlot(d)}
                    className="bg-emerald-500 px-3 rounded"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 flex justify-end">
          <button
            onClick={save}
            disabled={!selectedMedecinId || saving}
            className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer / Générer"}
          </button>
        </div>
      </div>
    </div>
  );
}
