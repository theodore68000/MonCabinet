"use client";

import { useEffect, useMemo, useState } from "react";

export type ModalMode = "dayButton" | "weekButton" | "click";

type Props = {
  open: boolean;
  onClose: (refresh: boolean) => void;

  medecinId?: number;

  date: string;
  heure: string;
  mode: ModalMode;

  rdvId?: number | null;

  initialTypeConsultation?: string | null;
};

type CsvPatient = {
  id: number;
  nom: string;
  prenom: string;
  dateNaissance: string;
};

type PatientMode = "none" | "csv" | "hors";

const normalize = (v: string) =>
  (v ?? "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default function AddSlotModal({
  open,
  onClose,
  medecinId,
  date,
  heure,
  mode,
  rdvId,
  initialTypeConsultation,
}: Props) {
  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */
  const [patientMode, setPatientMode] = useState<PatientMode>("none");

  // CSV
  const [csvPatients, setCsvPatients] = useState<CsvPatient[]>([]);
  const [csvSearch, setCsvSearch] = useState("");
  const [selectedCsvPatient, setSelectedCsvPatient] =
    useState<CsvPatient | null>(null);
  const [csvLoaded, setCsvLoaded] = useState(false);

  // Hors cabinet
  const [horsNom, setHorsNom] = useState("");
  const [horsPrenom, setHorsPrenom] = useState("");

  // Date / heure
  const [localDate, setLocalDate] = useState(date);
  const [localHeure, setLocalHeure] = useState(heure);

  const [typeConsultation, setTypeConsultation] = useState<
    "PRESENTIEL" | "VISIO"
  >(initialTypeConsultation === "VISIO" ? "VISIO" : "PRESENTIEL");

  const [error, setError] = useState("");

  const isEdit = !!rdvId;

  /* -------------------------------------------------------
     INIT RESET
  ------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    setLocalDate(date);
    setLocalHeure(heure);
    setTypeConsultation(
      initialTypeConsultation === "VISIO" ? "VISIO" : "PRESENTIEL"
    );

    setPatientMode("none");
    setCsvSearch("");
    setSelectedCsvPatient(null);
    setError("");
    setHorsNom("");
    setHorsPrenom("");
    setCsvLoaded(false);
  }, [open, date, heure, initialTypeConsultation]);

  /* -------------------------------------------------------
     CSV AUTOCOMPLETE
  ------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    if (patientMode !== "csv") return;
    if (!medecinId) return;

    const q = csvSearch.trim();
    if (q.length < 2) {
      setCsvPatients([]);
      return;
    }

    const controller = new AbortController();

    fetch(
      `http://localhost:3001/medecin/${medecinId}/patients-csv?query=${encodeURIComponent(
        q
      )}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setCsvPatients(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setCsvPatients([]);
      });

    return () => controller.abort();
  }, [open, patientMode, medecinId, csvSearch]);

  /* -------------------------------------------------------
     HELPERS
  ------------------------------------------------------- */
  const computeFinalDateHeure = () => {
    if (mode === "weekButton")
      return { finalDate: localDate, finalHeure: localHeure };
    if (mode === "dayButton")
      return { finalDate: date, finalHeure: localHeure };
    return { finalDate: date, finalHeure: heure };
  };

  const filteredCsvPatients = useMemo(() => {
    if (patientMode !== "csv") return [];
    return csvPatients;
  }, [patientMode, csvPatients]);

  /* -------------------------------------------------------
     CREATE / UPDATE (FIX ICI)
  ------------------------------------------------------- */
  const handleCreateOrUpdate = async () => {
    if (!medecinId) return setError("Médecin introuvable.");

    const { finalDate, finalHeure } = computeFinalDateHeure();
    if (!finalDate || !finalHeure)
      return setError("Date et heure obligatoires.");

    if (patientMode === "csv" && !selectedCsvPatient)
      return setError("Sélectionnez un patient du médecin.");

    if (patientMode === "hors" && (!horsNom || !horsPrenom))
      return setError("Nom et prénom requis (hors cabinet).");

    setError("");

    // ----------------------------
    // Payload commun (FIX typeSlot)
    // ----------------------------
    const payload: any = {
      medecinId,
      date: finalDate,
      heure: finalHeure,
      typeSlot: patientMode === "none" ? "LIBRE" : "PRIS",
      typeConsultation,
    };

    // ----------------------------
    // Identité patient
    // ----------------------------
    if (patientMode === "csv" && selectedCsvPatient) {
      payload.patientId = selectedCsvPatient.id;
      payload.patientIdentity = {
        source: "CSV",
        nom: selectedCsvPatient.nom,
        prenom: selectedCsvPatient.prenom,
        dateNaissance: selectedCsvPatient.dateNaissance,
      };
    }

    if (patientMode === "hors") {
      payload.patientIdentity = {
        source: "HORS",
        nom: horsNom,
        prenom: horsPrenom,
      };
    }

    try {
const res = await fetch(
  "http://localhost:3001/rdv/upload/medecin",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }
);


      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return setError(data?.message || "Erreur lors de l'enregistrement.");
      }

      onClose(true);
    } catch {
      setError("Erreur serveur.");
    }
  };

  /* -------------------------------------------------------
     BLOCK EMPTY SLOT
  ------------------------------------------------------- */
  const handleBlockEmptySlot = async () => {
    if (!medecinId) return setError("Médecin introuvable.");

    const { finalDate, finalHeure } = computeFinalDateHeure();

    try {
      const res = await fetch("http://localhost:3001/rdv/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medecinId,
          date: finalDate,
          heure: finalHeure,
          typeSlot: "BLOQUE",
        }),
      });

      if (!res.ok) return setError("Impossible de bloquer ce créneau.");

      onClose(true);
    } catch {
      setError("Erreur serveur.");
    }
  };





  /* -------------------------------------------------------
     RENDER: POP-UP overlay (comme avant)
  ------------------------------------------------------- */
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 p-6 rounded-xl w-[520px] max-w-[90vw] space-y-4 border border-slate-700 shadow-xl">
        <h2 className="text-xl font-bold text-emerald-400">
          Ajouter un créneau ou un rendez-vous
        </h2>

        <div className="text-sm text-slate-200 space-y-1">
          <div>
            <span className="text-slate-400">Date :</span>{" "}
            {mode === "weekButton" ? localDate : date}
          </div>
          <div>
            <span className="text-slate-400">Heure :</span>{" "}
            {mode === "click" ? heure : localHeure}
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-sm text-slate-100">Patient</p>
          <div className="flex gap-2 text-xs">
            {[
              ["none", "Aucun"],
              ["csv", "Patient du médecin (CSV)"],
              ["hors", "Hors cabinet"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setPatientMode(k as PatientMode);
                  setError("");

                  if (k !== "csv") {
                    setCsvSearch("");
                    setSelectedCsvPatient(null);
                  }

                  if (k === "csv") {
                    // on ne reset pas csvPatients (on garde le cache),
                    // mais on reset la sélection et la recherche
                    setCsvSearch("");
                    setSelectedCsvPatient(null);
                  }

                  if (k !== "hors") {
                    setHorsNom("");
                    setHorsPrenom("");
                  }
                }}
                className={`flex-1 px-2 py-1 rounded ${
                  patientMode === k
                    ? "bg-emerald-500 text-black"
                    : "bg-slate-800 text-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* CSV autocomplete (fix) */}
        {patientMode === "csv" && (
          <>
            <input
              placeholder="Rechercher par nom / prénom / date"
              value={csvSearch}
              onChange={(e) => {
                setCsvSearch(e.target.value);
                setSelectedCsvPatient(null);
                setError("");
              }}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-sm text-slate-100"
            />

            <div className="max-h-32 overflow-y-auto space-y-1">
              {filteredCsvPatients.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-2">
                  Aucun résultat
                </p>
              ) : (
                filteredCsvPatients.map((p, i) => {
                  const selected =
                    selectedCsvPatient?.nom === p.nom &&
                    selectedCsvPatient?.prenom === p.prenom &&
                    selectedCsvPatient?.dateNaissance === p.dateNaissance;

                  return (
                    <button
                      key={`${p.nom}-${p.prenom}-${p.dateNaissance}-${i}`}
                      onClick={() => {
                        setSelectedCsvPatient(p);
                        setError("");
                      }}
                      className={`w-full text-left px-2 py-1 text-xs rounded text-slate-100 transition
                        ${
                          selected
                            ? "bg-emerald-500/20 border border-emerald-400 shadow-inner"
                            : "bg-slate-800 hover:bg-slate-700"
                        }`}
                    >
                      {p.prenom} {p.nom} — {p.dateNaissance}
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Hors cabinet */}
        {patientMode === "hors" && (
          <div className="space-y-2 text-sm">
            <input
              placeholder="Nom"
              value={horsNom}
              onChange={(e) => setHorsNom(e.target.value)}
              className="w-full p-2 bg-slate-800 rounded border border-slate-700 text-slate-100"
            />
            <input
              placeholder="Prénom"
              value={horsPrenom}
              onChange={(e) => setHorsPrenom(e.target.value)}
              className="w-full p-2 bg-slate-800 rounded border border-slate-700 text-slate-100"
            />
          </div>
        )}

        {/* Type consultation */}
        {patientMode !== "none" && (
          <div className="space-y-1 text-sm text-slate-100">
            <p className="font-semibold">Type de consultation</p>
            <label>
              <input
                type="radio"
                checked={typeConsultation === "PRESENTIEL"}
                onChange={() => setTypeConsultation("PRESENTIEL")}
              />{" "}
              Cabinet
            </label>
            <label className="ml-4">
              <input
                type="radio"
                checked={typeConsultation === "VISIO"}
                onChange={() => setTypeConsultation("VISIO")}
              />{" "}
              Visio
            </label>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex justify-between pt-2">
          {!isEdit && (
            <button
              onClick={handleBlockEmptySlot}
              className="bg-red-600 px-3 py-2 rounded text-sm font-semibold text-white"
            >
              Bloquer
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => onClose(false)}
              className="text-slate-400 px-3 py-2"
            >
              Annuler
            </button>
            <button
              onClick={handleCreateOrUpdate}
              className="bg-emerald-500 px-4 py-2 rounded font-bold text-black"
            >
              Valider
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
