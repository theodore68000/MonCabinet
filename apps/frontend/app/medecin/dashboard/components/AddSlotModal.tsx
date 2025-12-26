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
  rdvId?: number | null; // ✅ permet overwrite / annulation soft

  // (vient de la vue d'accueil / planning quand tu cliques un créneau)
  typeSlot?: "LIBRE" | "PRIS" | "BLOQUE" | "HORS";
  formulaireDemande?: boolean;
};

type CsvPatient = {
  id: number;
  nom: string;
  prenom: string;
  dateNaissance: string;
};

type PatientMode = "none" | "csv" | "hors";

type FormulaireResponse = {
  id: number;
  rdvId: number;
  medecinId: number;
  patientId: number;
  reponses: any | null;
  rempli: boolean;
  createdAt: string;
  updatedAt: string;
  rdv?: {
    id: number;
    date: string;
    heure: string;
    motif?: string | null;
    typeConsultation?: string;
    patient?: { id: number; nom: string; prenom: string; email?: string };
    medecin?: { id: number; nom: string; prenom: string; email?: string };
  };
};

export default function AddSlotModal({
  open,
  onClose,
  medecinId,
  date,
  heure,
  mode,
  rdvId, // ✅ destructure obligatoire

  typeSlot,
  formulaireDemande: formulaireDemandeFromProps,
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

  // 🔑 flag sélection manuelle
  const [hasUserSelectedPatient, setHasUserSelectedPatient] = useState(false);

  // Hors cabinet
  const [horsNom, setHorsNom] = useState("");
  const [horsPrenom, setHorsPrenom] = useState("");

  // Date / heure
  const [localDate, setLocalDate] = useState(date);
  const [localHeure, setLocalHeure] = useState(heure);

  const [typeConsultation, setTypeConsultation] = useState<
    "PRESENTIEL" | "VISIO"
  >("PRESENTIEL");

  // checkbox formulaire
  const [formulaireDemande, setFormulaireDemande] = useState<boolean>(false);

  // preview formulaire
  const [formPreviewOpen, setFormPreviewOpen] = useState(false);
  const [formPreviewLoading, setFormPreviewLoading] = useState(false);
  const [formPreviewError, setFormPreviewError] = useState("");
  const [formPreviewData, setFormPreviewData] =
    useState<FormulaireResponse | null>(null);

  const [error, setError] = useState("");

  /* -------------------------------------------------------
     INIT RESET
  ------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    setLocalDate(date);
    setLocalHeure(heure);
    setPatientMode("none");
    setCsvSearch("");
    setSelectedCsvPatient(null);
    setHasUserSelectedPatient(false);
    setHorsNom("");
    setHorsPrenom("");
    setTypeConsultation("PRESENTIEL");

    // sync depuis props (si slot PRIS existant)
    setFormulaireDemande(formulaireDemandeFromProps === true);

    // reset preview
    setFormPreviewOpen(false);
    setFormPreviewLoading(false);
    setFormPreviewError("");
    setFormPreviewData(null);

    setError("");
  }, [open, date, heure, formulaireDemandeFromProps]);

  /* -------------------------------------------------------
     CSV AUTOCOMPLETE
  ------------------------------------------------------- */
  useEffect(() => {
    if (!open || patientMode !== "csv" || !medecinId) return;

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
      .then((data) => setCsvPatients(Array.isArray(data) ? data : []))
      .catch(() => setCsvPatients([]));

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

  const filteredCsvPatients = useMemo(
    () => (patientMode === "csv" ? csvPatients : []),
    [patientMode, csvPatients]
  );

  // visible depuis l’accueil quand créneau PRIS + formulaire demandé + rdvId présent
  const canShowFormPreviewButton =
    typeSlot === "PRIS" && Boolean(rdvId);

  // helper overwrite payload
  const withReplace = (payload: any) => ({
    ...payload,
    // 🔑 Overwrite: si un rdvId est connu, on force le remplacement côté back
    replaceRdvId: rdvId ?? undefined,
  });

  /* -------------------------------------------------------
     PREVIEW FORMULAIRE
  ------------------------------------------------------- */
  const openFormPreview = async () => {
    if (!rdvId) return;

    setFormPreviewOpen(true);
    setFormPreviewLoading(true);
    setFormPreviewError("");
    setFormPreviewData(null);

    try {
      const res = await fetch(`http://localhost:3001/formulaire/${rdvId}`, {
        method: "GET",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          data?.message ||
          (res.status === 404
            ? "Formulaire introuvable (pas encore créé)."
            : "Impossible de charger le formulaire.");
        setFormPreviewError(msg);
        setFormPreviewLoading(false);
        return;
      }

      const data = (await res.json()) as FormulaireResponse;
      setFormPreviewData(data);
      setFormPreviewLoading(false);
    } catch {
      setFormPreviewError("Erreur serveur.");
      setFormPreviewLoading(false);
    }
  };

  /* -------------------------------------------------------
     ACTIONS (OVERWRITE PARTOUT)
  ------------------------------------------------------- */
  const handleBlock = async () => {
    if (!medecinId) return setError("Médecin introuvable.");
    const { finalDate, finalHeure } = computeFinalDateHeure();

    try {
      const res = await fetch("http://localhost:3001/rdv/upload/medecin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withReplace({
            medecinId,
            date: finalDate,
            heure: finalHeure,
            typeSlot: "BLOQUE",
          })
        ),
      });

      if (!res.ok) return setError("Impossible de bloquer ce créneau.");
      onClose(true);
    } catch {
      setError("Erreur serveur.");
    }
  };

  const handleLibre = async () => {
    if (!medecinId) return setError("Médecin introuvable.");
    const { finalDate, finalHeure } = computeFinalDateHeure();

    try {
      const res = await fetch("http://localhost:3001/rdv/upload/medecin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withReplace({
            medecinId,
            date: finalDate,
            heure: finalHeure,
            typeSlot: "LIBRE",
          })
        ),
      });

      if (!res.ok) return setError("Impossible de libérer ce créneau.");
      onClose(true);
    } catch {
      setError("Erreur serveur.");
    }
  };

  /**
   * ✅ NOUVELLE RÈGLE :
   * Annuler = remettre le créneau à l'état "HORS" (case vide), QUEL QUE SOIT l'état.
   * - Si rdvId existe : DELETE /rdv/:id (le back recrée en HORS)
   * - Si rdvId n'existe pas : on force HORS via /rdv/upload/medecin (slot persistant)
   */
const handleAnnuler = async () => {
  // ✅ case déjà vierge → rien à faire
  if (!rdvId) {
    onClose(true);
    return;
  }

  try {
    const res = await fetch(`http://localhost:3001/rdv/${rdvId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      setError("Impossible d’annuler ce créneau.");
      return;
    }

    // 🔑 DELETE HARD → la case redevient vierge
    onClose(true);
  } catch {
    setError("Erreur serveur.");
  }
};


const handleSave = async () => {
  if (!medecinId) {
    setError("Médecin introuvable.");
    return;
  }

  // ⛔ RÈGLE CRITIQUE :
  // Case vierge + aucun patient sélectionné = INTERDIT
  if (!rdvId && patientMode === "none") {
    setError("Veuillez sélectionner un patient ou une action (bloquer / libérer).");
    return;
  }

  if (patientMode === "csv" && !selectedCsvPatient) {
    setError("Sélectionnez un patient.");
    return;
  }

  if (patientMode === "hors" && (!horsNom || !horsPrenom)) {
    setError("Nom et prénom requis.");
    return;
  }

  const { finalDate, finalHeure } = computeFinalDateHeure();

  const payload: any = withReplace({
    medecinId,
    date: finalDate,
    heure: finalHeure,
    typeSlot: "PRIS", // ✅ uniquement si patient présent
    typeConsultation,
    formulaireDemande: formulaireDemande === true,
  });

  // Patient CSV
  if (patientMode === "csv" && selectedCsvPatient) {
    payload.patientId = selectedCsvPatient.id;
    payload.patientIdentity = {
      source: "CSV",
      nom: selectedCsvPatient.nom,
      prenom: selectedCsvPatient.prenom,
      dateNaissance: selectedCsvPatient.dateNaissance,
    };
  }

  // Patient hors cabinet
  if (patientMode === "hors") {
    payload.patientIdentity = {
      source: "HORS",
      nom: horsNom,
      prenom: horsPrenom,
    };
  }

  try {
    const res = await fetch("http://localhost:3001/rdv/upload/medecin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.message || "Erreur lors de l'enregistrement.");
      return;
    }

    onClose(true);
  } catch {
    setError("Erreur serveur.");
  }
};


  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */
  if (!open) return null;

  // UI inchangée : on garde le disable libre si PRIS (si tu veux le retirer, mets false)
const libreDisabled = false;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 p-6 rounded-xl w-[520px] max-w-[90vw] space-y-4 border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-emerald-400">
            Créneau / Rendez-vous
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={openFormPreview}
              disabled={!canShowFormPreviewButton}
              className={`text-slate-300 hover:text-white text-xs px-2 py-1 rounded bg-slate-800 border focus:outline-none ${
                canShowFormPreviewButton
                  ? "border-slate-700"
                  : "border-slate-800 text-slate-500 cursor-not-allowed hover:text-slate-500"
              }`}
              title={
                canShowFormPreviewButton
                  ? "Voir le formulaire lié à ce RDV"
                  : "Formulaire non demandé ou RDV inexistant"
              }
            >
              Voir le formulaire
            </button>

            <button
              onClick={handleAnnuler}
              className="text-slate-300 hover:text-white text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 focus:outline-none"
              title="Annuler et remettre la case vierge"
            >
              Annuler
            </button>

            <button
              onClick={() => onClose(false)}
              className="text-slate-400 hover:text-white focus:outline-none"
              title="Fermer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Infos */}
        <div className="text-sm text-slate-200">
          <div>
            <span className="text-slate-400">Date :</span>{" "}
            {mode === "weekButton" ? localDate : date}
          </div>
          <div>
            <span className="text-slate-400">Heure :</span>{" "}
            {mode === "click" ? heure : localHeure}
          </div>
        </div>

        {/* Patient */}
        <div>
          <p className="font-semibold text-sm text-slate-100 mb-1">Patient</p>
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
                  setCsvSearch("");
                  setSelectedCsvPatient(null);
                  setHasUserSelectedPatient(false);
                  setHorsNom("");
                  setHorsPrenom("");
                }}
                className={`flex-1 px-2 py-1 rounded focus:outline-none ${
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

        {/* CSV */}
        {patientMode === "csv" && (
          <>
            <input
              placeholder="Rechercher nom / prénom"
              value={csvSearch}
              onChange={(e) => setCsvSearch(e.target.value)}
              className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-sm"
            />
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filteredCsvPatients.map((p) => (
                <button
                  key={`${p.id}-${p.nom}-${p.prenom}-${p.dateNaissance}`}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setSelectedCsvPatient(p);
                    setHasUserSelectedPatient(true);
                  }}
                  className={`w-full text-left px-2 py-1 text-xs rounded transition
                    focus:outline-none focus:ring-0
                    ${
                      hasUserSelectedPatient &&
                      selectedCsvPatient?.id === p.id
                        ? "bg-emerald-500/20 border border-emerald-400"
                        : "bg-slate-800 hover:bg-slate-700"
                    }`}
                >
                  {p.prenom} {p.nom} — {p.dateNaissance}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Hors */}
        {patientMode === "hors" && (
          <div className="space-y-2">
            <input
              placeholder="Nom"
              value={horsNom}
              onChange={(e) => setHorsNom(e.target.value)}
              className="w-full p-2 bg-slate-800 rounded border border-slate-700"
            />
            <input
              placeholder="Prénom"
              value={horsPrenom}
              onChange={(e) => setHorsPrenom(e.target.value)}
              className="w-full p-2 bg-slate-800 rounded border border-slate-700"
            />
          </div>
        )}

        {/* Type consultation + Formulaire */}
        {patientMode !== "none" && (
          <div className="text-sm space-y-3">
            <div>
              <p className="font-semibold mb-1">Type de consultation</p>
              <label className="text-slate-100">
                <input
                  type="radio"
                  checked={typeConsultation === "PRESENTIEL"}
                  onChange={() => setTypeConsultation("PRESENTIEL")}
                />{" "}
                Cabinet
              </label>
              <label className="ml-4 text-slate-100">
                <input
                  type="radio"
                  checked={typeConsultation === "VISIO"}
                  onChange={() => setTypeConsultation("VISIO")}
                />{" "}
                Visio
              </label>
            </div>

            <div className="flex items-center justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
              <label className="flex items-center gap-2 text-xs text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={formulaireDemande}
                  onChange={(e) => setFormulaireDemande(e.target.checked)}
                />
                Envoyer le formulaire de pré-consultation
              </label>

              <button
                onClick={openFormPreview}
                disabled={!canShowFormPreviewButton}
                className={`text-xs px-3 py-1 rounded border focus:outline-none ${
                  canShowFormPreviewButton
                    ? "bg-slate-900 border-slate-600 text-slate-200 hover:text-white hover:border-slate-500"
                    : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed"
                }`}
                title={
                  canShowFormPreviewButton
                    ? "Voir le formulaire lié à ce RDV"
                    : "Formulaire non demandé ou RDV inexistant"
                }
              >
                Voir le formulaire
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Actions */}
        <div className="flex justify-between pt-3">
          <div className="flex gap-2">
            <button
              onClick={handleBlock}
              className="bg-red-600 px-3 py-2 rounded text-sm font-semibold text-white focus:outline-none"
            >
              Bloquer
            </button>

            <button
              onClick={handleLibre}
              disabled={libreDisabled}
              className={`px-3 py-2 rounded text-sm font-semibold focus:outline-none ${
                libreDisabled
                  ? "bg-fuchsia-600/40 text-white/60 cursor-not-allowed"
                  : "bg-fuchsia-600 text-white"
              }`}
              title={
                libreDisabled
                  ? "Créneau PRIS : utilisez 'Annuler' pour annuler le rendez-vous."
                  : "Libérer ce créneau"
              }
            >
              Libre
            </button>
          </div>

          <button
            onClick={handleSave}
            className="bg-emerald-500 px-4 py-2 rounded font-bold text-black focus:outline-none"
          >
            Enregistrer
          </button>
        </div>
      </div>

      {/* Sous-modale preview formulaire */}
      {formPreviewOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 p-5 rounded-xl w-[620px] max-w-[92vw] border border-slate-700 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-emerald-400">
                Formulaire de pré-consultation
              </h3>
              <button
                onClick={() => {
                  setFormPreviewOpen(false);
                  setFormPreviewLoading(false);
                  setFormPreviewError("");
                  setFormPreviewData(null);
                }}
                className="text-slate-400 hover:text-white focus:outline-none"
                title="Fermer"
              >
                ✕
              </button>
            </div>

            {formPreviewLoading && (
              <p className="text-xs text-slate-300">Chargement...</p>
            )}

            {formPreviewError && (
              <p className="text-xs text-red-400">{formPreviewError}</p>
            )}

            {!formPreviewLoading && !formPreviewError && formPreviewData && (
              <div className="space-y-3">
                <div className="text-xs text-slate-200 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <div>
                    <span className="text-slate-400">RDV :</span>{" "}
                    {formPreviewData.rdv?.date
                      ? new Date(formPreviewData.rdv.date).toLocaleDateString(
                          "fr-FR"
                        )
                      : "—"}{" "}
                    à {formPreviewData.rdv?.heure ?? "—"}
                  </div>
                  <div>
                    <span className="text-slate-400">Statut :</span>{" "}
                    {formPreviewData.rempli ? "Rempli" : "Non rempli"}
                  </div>
                  {formPreviewData.rdv?.patient && (
                    <div>
                      <span className="text-slate-400">Patient :</span>{" "}
                      {formPreviewData.rdv.patient.prenom}{" "}
                      {formPreviewData.rdv.patient.nom}
                    </div>
                  )}
                </div>

                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-100 mb-2">
                    Réponses (JSON)
                  </p>

                  <pre className="text-[11px] text-slate-200 whitespace-pre-wrap break-words">
                    {JSON.stringify(formPreviewData.reponses ?? {}, null, 2)}
                  </pre>
                </div>

                <div className="text-[11px] text-slate-400">
                  Créé le{" "}
                  {new Date(formPreviewData.createdAt).toLocaleString("fr-FR")}
                  {" · "}
                  Mis à jour le{" "}
                  {new Date(formPreviewData.updatedAt).toLocaleString("fr-FR")}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setFormPreviewOpen(false)}
                className="text-xs px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-200 hover:text-white focus:outline-none"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
