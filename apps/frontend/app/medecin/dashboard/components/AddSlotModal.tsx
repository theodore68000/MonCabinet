"use client";

import { useState, useEffect } from "react";

export type ModalMode = "dayButton" | "weekButton" | "click";

type Props = {
  open: boolean;
  onClose: (refresh: boolean) => void;
  medecinId?: number;
  date: string; // "YYYY-MM-DD"
  heure: string; // "HH:MM" ou ""
  mode: ModalMode;

  // Quand on clique sur un slot qui a déjà un RDV
  rdvId?: number | null;
  initialPatientId?: number | null;
};

type Patient = {
  id: number;
  nom: string;
  prenom: string;
};

export default function AddSlotModal({
  open,
  onClose,
  medecinId,
  date,
  heure,
  mode,
  rdvId,
  initialPatientId,
}: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [localDate, setLocalDate] = useState<string>(date);
  const [localHeure, setLocalHeure] = useState<string>(heure);
  const [patientId, setPatientId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const isEdit = !!rdvId;

  useEffect(() => {
    if (!open) return;

    const fetchPatients = async () => {
      try {
        const res = await fetch("http://localhost:3001/patient");
        const data = await res.json();
        setPatients(data);
      } catch {
        setPatients([]);
      }
    };

    setLocalDate(date);
    setLocalHeure(heure);
    setPatientId(initialPatientId ? String(initialPatientId) : "");
    setError("");
    fetchPatients();
  }, [open, date, heure, initialPatientId]);

  const formatDate = (d: string) => {
    if (!d) return "";
    const obj = new Date(d);
    return obj.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  };

  const computeFinalDateHeure = () => {
    let finalDate = date;
    let finalHeure = heure;

    if (mode === "weekButton") {
      finalDate = localDate;
      finalHeure = localHeure;
    } else if (mode === "dayButton") {
      finalDate = date;
      finalHeure = localHeure;
    } else if (mode === "click") {
      finalDate = date;
      finalHeure = heure;
    }

    return { finalDate, finalHeure };
  };

  const handleCreateOrUpdate = async () => {
    if (!medecinId) {
      setError("Médecin introuvable.");
      return;
    }

    const { finalDate, finalHeure } = computeFinalDateHeure();

    if (!finalDate || !finalHeure) {
      setError("Merci de renseigner la date et l'heure.");
      return;
    }

    try {
      const hasPatient = !!patientId;

      // ───────────── UPDATE EXISTANT ─────────────
      if (isEdit && rdvId) {
        const body: any = {
          medecinId,
          date: finalDate,
          heure: finalHeure,
        };

        if (hasPatient) {
          body.patientId = Number(patientId);
          body.statut = "confirmé";
          body.motif = "Consultation";
        } else {
          // Créneau libre explicite
          body.patientId = null;
          body.statut = "disponible";
          body.motif = null;
        }

        const res = await fetch(`http://localhost:3001/rdv/${rdvId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(
            data?.message || "Erreur lors de la mise à jour du créneau.",
          );
          return;
        }

        onClose(true);
        return;
      }

      // ───────────── CREATION NOUVEAU ─────────────
      if (hasPatient) {
        // Création d'un rendez-vous avec patient
        const res = await fetch("http://localhost:3001/rdv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medecinId,
            patientId: Number(patientId),
            date: finalDate,
            heure: finalHeure,
            motif: "Consultation",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(
            data?.message || "Erreur lors de la création du rendez-vous.",
          );
          return;
        }
      } else {
        // Création d'un créneau libre
        const res = await fetch("http://localhost:3001/rdv/slot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            medecinId,
            date: finalDate,
            heure: finalHeure,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(
            data?.message ||
              "Erreur lors de la création du créneau libre.",
          );
          return;
        }
      }

      onClose(true);
    } catch {
      setError("Erreur lors de l'enregistrement du créneau.");
    }
  };

  // Supprimer = bloquer le créneau (statut = indisponible)
  const handleDelete = async () => {
    if (!rdvId) return;
    try {
      const res = await fetch(`http://localhost:3001/rdv/${rdvId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.message || "Erreur lors de la suppression du créneau.",
        );
        return;
      }

      onClose(true);
    } catch {
      setError("Erreur lors de la suppression du créneau.");
    }
  };

  if (!open) return null;

  const isClickMode = mode === "click";

  const title = isEdit
    ? initialPatientId
      ? "Modifier le rendez-vous"
      : "Créneau libre"
    : "Ajouter un rendez-vous";

  const firstOptionLabel = isEdit
    ? "Laisser libre"
    : "Aucun patient (créneau libre)";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 p-6 rounded-xl w-96 space-y-4 border border-slate-700 shadow-xl">
        <h2 className="text-xl font-bold text-emerald-400">{title}</h2>

        {/* Date / heure selon le mode */}
        {mode === "dayButton" && (
          <>
            <p className="text-sm text-slate-300">
              Date :{" "}
              <span className="font-semibold">{formatDate(date)}</span>
            </p>
            <input
              type="time"
              className="w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={localHeure}
              onChange={(e) => setLocalHeure(e.target.value)}
            />
          </>
        )}

        {mode === "weekButton" && (
          <>
            <input
              type="date"
              className="w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={localDate}
              onChange={(e) => setLocalDate(e.target.value)}
            />
            <input
              type="time"
              className="w-full p-2 rounded bg-slate-800 border border-slate-700"
              value={localHeure}
              onChange={(e) => setLocalHeure(e.target.value)}
            />
          </>
        )}

        {isClickMode && (
          <div className="space-y-1 text-sm text-slate-300">
            <p>
              Date :{" "}
              <span className="font-semibold">{formatDate(date)}</span>
            </p>
            <p>
              Heure : <span className="font-semibold">{heure}</span>
            </p>
          </div>
        )}

        {/* Patient */}
        <select
          className="w-full p-2 bg-slate-800 border border-slate-700 rounded"
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
        >
          <option value="">{firstOptionLabel}</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.prenom} {p.nom}
            </option>
          ))}
        </select>

        {error && (
          <p className="text-red-400 text-xs mt-1 text-center">
            {error}
          </p>
        )}

        <div className="flex justify-between items-center pt-3">
          {isEdit ? (
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 text-sm font-semibold px-4 py-2 rounded"
            >
              Supprimer le créneau
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onClose(false)}
              className="text-slate-400 px-4 py-2 text-sm"
            >
              Annuler
            </button>

            <button
              onClick={handleCreateOrUpdate}
              className="bg-emerald-500 px-4 py-2 rounded text-black font-bold hover:bg-emerald-400 text-sm"
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
