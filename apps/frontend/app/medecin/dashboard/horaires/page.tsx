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
] as const;

type DayKey = (typeof ORDER)[number];

/**
 * Option A: on charge le médecin via GET /medecin/:id
 * ➜ l'ID doit venir du front (pas de /medecin/me côté back).
 *
 * Si ta clé n'est pas "medecinId", modifie juste cette constante.
 */
const MEDECIN_ID_KEY = "medecinId";

/* -------------------------------------------------------
   HELPERS (IDENTIQUES ScheduleDrawer) + FIX
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

/**
 * Convertit une liste de slots "HH:MM" en intervalles "HH:MM-HH:MM"
 * (utile si anciennes données stockées en slots)
 */
const slotsToIntervals = (slots: string[]) => {
  if (!Array.isArray(slots) || slots.length === 0) return [];

  const uniq = Array.from(
    new Set(slots.filter((s) => /^\d{2}:\d{2}$/.test(s)))
  );
  const sorted = uniq.sort((a, b) => toMinutes(a) - toMinutes(b));
  if (sorted.length === 0) return [];

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

/**
 * Normalise/valide les intervalles:
 * - format "HH:MM-HH:MM"
 * - end > start
 * - pas de 15 minutes
 * - tri + dédup
 */
const normalizeIntervals = (arr: string[]) => {
  const cleaned = (Array.isArray(arr) ? arr : [])
    .map((v) => (v ?? "").toString().trim())
    .filter(Boolean);

  const valid: string[] = [];
  for (const it of cleaned) {
    const m = it.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) continue;

    const s = m[1];
    const e = m[2];
    const sm = toMinutes(s);
    const em = toMinutes(e);

    if (!(em > sm)) continue;
    if (sm % 15 !== 0 || em % 15 !== 0) continue;

    valid.push(`${s}-${e}`);
  }

  const dedup = Array.from(new Set(valid));
  dedup.sort((a, b) => toMinutes(a.split("-")[0]) - toMinutes(b.split("-")[0]));
  return dedup;
};

const mergeIntervalsNoOverlap = (existing: string[], next: string) => {
  // stratégie simple et prévisible: on ajoute, on normalise, et on ne tente pas de fusion intelligente
  // (fusion automatique = source de surprises UX).
  return normalizeIntervals([...(existing || []), next]);
};

const isValidTime = (t: string) => /^\d{2}:\d{2}$/.test(t);
const isQuarter = (t: string) => toMinutes(t) % 15 === 0;

/* -------------------------------------------------------
   API ENDPOINTS
---------------------------------------------------------*/
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

/**
 * On garde credentials: "include" (ne casse rien, future-proof).
 */
const apiFetch = (url: string, options: RequestInit = {}) =>
  fetch(url, {
    ...options,
    credentials: "include",
  });

/* -------------------------------------------------------
   COMPONENT
---------------------------------------------------------*/
export default function HorairesReferencePage() {
  const router = useRouter();

  const [medecin, setMedecin] = useState<any>(null);

  // IMPORTANT (nouveau modèle):
  // localHoraires = TEMPLATE de génération (pas un planning imposé)
  const [localHoraires, setLocalHoraires] = useState<Record<DayKey, string[]>>({
    lundi: [],
    mardi: [],
    mercredi: [],
    jeudi: [],
    vendredi: [],
    samedi: [],
    dimanche: [],
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // message succès spécifique "génération"
  const [savedOk, setSavedOk] = useState(false);

  const [newStart, setNewStart] = useState<Record<string, string>>({});
  const [newEnd, setNewEnd] = useState<Record<string, string>>({});

  const startRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const endRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* -------------------------------------------------------
     LOAD
     - on charge le médecin via /medecin/:id
     - on lit son TEMPLATE horairesReference (si présent)
  ---------------------------------------------------------*/
  useEffect(() => {
    const fetchMed = async () => {
      setLoading(true);
      setError(null);
      setSavedOk(false);

      try {
        const rawId =
          typeof window !== "undefined"
            ? localStorage.getItem(MEDECIN_ID_KEY)
            : null;
        const medecinId = rawId ? Number(rawId) : NaN;

        if (!medecinId || Number.isNaN(medecinId)) {
          throw new Error(
            `medecinId introuvable. Attendu dans localStorage("${MEDECIN_ID_KEY}").`
          );
        }

        const res = await apiFetch(`${API_BASE}/medecin/${medecinId}`);
        if (!res.ok) throw new Error("Impossible de charger le médecin.");

        const data = await res.json();
        setMedecin(data);

        // Nouveau modèle: on privilégie horairesReference comme template.
        // On garde les fallbacks pour compat.
        const raw =
          data?.horairesReference ??
          data?.horaires ??
          data?.horairesReference ??
          {};

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
          const arr = Array.isArray(raw?.[d]) ? raw[d] : [];
          const asIntervals = arr.some(
            (v: string) => typeof v === "string" && v.includes("-")
          )
            ? (arr as string[])
            : slotsToIntervals(arr as string[]);
          normalized[d] = normalizeIntervals(asIntervals);
        });

        setLocalHoraires(normalized);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Erreur lors du chargement.");
      } finally {
        setLoading(false);
      }
    };

    fetchMed();
  }, []);

  /* -------------------------------------------------------
     SAVE = GÉNÉRATION ONE-SHOT
     PATCH /schedule-reference/:medecinId
     - sauvegarde le template
     - génère des slots LIBRES RÉELS sur 1 an
     - n’impose rien après: le planning se gère via /rdv
  ---------------------------------------------------------*/
  const save = async () => {
    if (!medecin?.id) return;

    setSaving(true);
    setError(null);
    setSavedOk(false);

    try {
      const payload: Record<DayKey, string[]> = {
        lundi: normalizeIntervals(localHoraires.lundi),
        mardi: normalizeIntervals(localHoraires.mardi),
        mercredi: normalizeIntervals(localHoraires.mercredi),
        jeudi: normalizeIntervals(localHoraires.jeudi),
        vendredi: normalizeIntervals(localHoraires.vendredi),
        samedi: normalizeIntervals(localHoraires.samedi),
        dimanche: normalizeIntervals(localHoraires.dimanche),
      };

      const res = await apiFetch(`${API_BASE}/schedule-reference/${medecin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ horairesReference: payload }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Erreur lors de l'enregistrement.");
      }

      // le back renvoie { success, horairesReference }
      const json = await res.json().catch(() => null);
      const returned = json?.horairesReference;

      // si le back a normalisé, on se réaligne (template uniquement)
      if (returned && typeof returned === "object") {
        const normalized: Record<DayKey, string[]> = {
          lundi: normalizeIntervals(returned.lundi || []),
          mardi: normalizeIntervals(returned.mardi || []),
          mercredi: normalizeIntervals(returned.mercredi || []),
          jeudi: normalizeIntervals(returned.jeudi || []),
          vendredi: normalizeIntervals(returned.vendredi || []),
          samedi: normalizeIntervals(returned.samedi || []),
          dimanche: normalizeIntervals(returned.dimanche || []),
        };
        setLocalHoraires(normalized);
      }

      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);

      // Optionnel (mais logique produit): après génération, tu peux renvoyer sur le planning réel.
      // Décommente si tu veux le flow direct.
      // router.push("/medecin/dashboard");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------
     ADD SLOT (same UI)
  ---------------------------------------------------------*/
  const addSlot = (day: DayKey) => {
    const s = (newStart[day] || "").trim();
    const e = (newEnd[day] || "").trim();

    if (!isValidTime(s) || !isValidTime(e)) return;
    if (!isQuarter(s) || !isQuarter(e)) return;
    if (toMinutes(e) <= toMinutes(s)) return;

    const next = `${s}-${e}`;
    setLocalHoraires((p) => ({
      ...p,
      [day]: mergeIntervalsNoOverlap(p[day] || [], next),
    }));

    setNewStart((p) => ({ ...p, [day]: "" }));
    setNewEnd((p) => ({ ...p, [day]: "" }));

    setTimeout(() => startRefs.current[day]?.focus(), 50);
  };

  /* -------------------------------------------------------
     REMOVE SLOT
  ---------------------------------------------------------*/
  const removeSlot = (day: DayKey, idx: number) => {
    setLocalHoraires((p) => ({
      ...p,
      [day]: (p[day] || []).filter((_, i) => i !== idx),
    }));
  };

  /* -------------------------------------------------------
     SET DAY OFF
  ---------------------------------------------------------*/
  const setDayOff = (day: DayKey) => {
    setLocalHoraires((p) => ({ ...p, [day]: [] }));
  };

  /* -------------------------------------------------------
     RENDER DAY (même UI)
  ---------------------------------------------------------*/
  const renderDay = (day: DayKey) => (
    <div
      key={day}
      className="bg-slate-800 p-5 rounded-xl border border-slate-700"
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold capitalize">{day}</h3>

        <button className="text-red-400 text-sm" onClick={() => setDayOff(day)}>
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
            <button className="text-red-300" onClick={() => removeSlot(day, i)}>
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
          onChange={(v) => setNewStart((p) => ({ ...p, [day]: v }))}
          ref={(el) => (startRefs.current[day] = el)}
          onComplete={() => endRefs.current[day]?.focus()}
        />

        <TimeField
          value={newEnd[day] || ""}
          onChange={(v) => setNewEnd((p) => ({ ...p, [day]: v }))}
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

        {/* même UI, wording adapté à la logique one-shot */}
        <h1 className="text-2xl font-bold mb-3 text-emerald-400">
          Générer mes créneaux libres
        </h1>

        <div className="mb-6 bg-slate-900/40 border border-slate-800 text-slate-200 p-3 rounded-xl">
          <p className="text-sm">
            Ce formulaire définit un <span className="font-semibold">template</span> et{" "}
            <span className="font-semibold">génère</span> des créneaux{" "}
            <span className="font-semibold">LIBRES réels</span> sur 12 mois.
            Ensuite, tout se gère dans le planning (déplacement/suppression/blocage/RDV).
            Rien n’est recalculé automatiquement.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-900/40 border border-red-700 text-red-200 p-3 rounded-xl">
            {error}
          </div>
        )}

        {savedOk && (
          <div className="mb-6 bg-emerald-900/30 border border-emerald-700 text-emerald-200 p-3 rounded-xl">
            Génération lancée : les créneaux libres ont été créés (sans écraser l’existant).
          </div>
        )}

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
            disabled={saving || loading || !medecin?.id}
            className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold disabled:opacity-60"
          >
            {saving ? "Génération..." : "Enregistrer / Générer"}
          </button>
        </div>
      </div>
    </div>
  );
}
