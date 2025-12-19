"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PatientOrProcheAutocomplete from "./components/PatientOrProcheAutocomplete";
import UploadDocumentForm from "./components/UploadDocumentForm";
import PatientDocumentsList from "./components/PatientDocumentsList";

export default function MedecinUploadDocumentPage() {
  const router = useRouter();

  const [medecinId, setMedecinId] = useState<number | null>(null);

  const [patientId, setPatientId] = useState<number | null>(null);
  const [procheId, setProcheId] = useState<number | null>(null);
  const [label, setLabel] = useState<string>("");

  /* lecture localStorage après hydratation */
  useEffect(() => {
    const raw = localStorage.getItem("medecinSession");
    if (!raw) return;

    try {
      const session = JSON.parse(raw);
      if (session?.id) {
        setMedecinId(session.id);
      }
    } catch {
      // ignore
    }
  }, []);

  /* état transitoire */
  if (medecinId === null) {
    return <p className="p-6">Chargement…</p>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* RETOUR DASHBOARD */}
      <button
        onClick={() => router.push("/medecin/dashboard")}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-2xl font-bold">Ajouter un document</h1>

      {/* Recherche patient / proche */}
      <PatientOrProcheAutocomplete
        medecinId={medecinId}
        onSelect={(r) => {
          if (r.type === "patient") {
            setPatientId(r.patientId);
            setProcheId(null);
            setLabel(
              `${r.prenom} ${r.nom}${
                r.dateNaissance ? ` — né(e) le ${r.dateNaissance}` : ""
              }`
            );
          } else {
            setPatientId(r.patientId);
            setProcheId(r.procheId);
            setLabel(
              `${r.prenom} ${r.nom} (${r.relation})${
                r.dateNaissance ? ` — né(e) le ${r.dateNaissance}` : ""
              } — patient : ${r.patientPrenom} ${r.patientNom}`
            );
          }
        }}
      />

      {label && (
        <div className="text-sm text-gray-600">
          Sélectionné : <strong>{label}</strong>
        </div>
      )}

      {/* Upload + documents */}
      {patientId ? (
        <>
          <UploadDocumentForm
            patientId={patientId}
            procheId={procheId}
            medecinId={medecinId}
            onUploaded={() => {
              alert("Document uploadé avec succès.");
            }}
          />

          <PatientDocumentsList
            patientId={patientId}
            procheId={procheId}
          />
        </>
      ) : (
        <p className="text-sm text-gray-500">
          Recherchez un patient ou un proche pour ajouter un document.
        </p>
      )}
    </div>
  );
}
