"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientDocumentsPage() {
  const router = useRouter();

  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const openDocument = (url: string) => {
    try {
      window.open(url, "_blank");
    } catch {
      alert("Impossible d’ouvrir le document.");
    }
  };

  useEffect(() => {
    const raw = localStorage.getItem("patientSession");
    if (!raw) {
      setLoading(false);
      return;
    }

    let patientId: number | null = null;

    try {
      const session = JSON.parse(raw);
      patientId = session?.id;
    } catch {
      patientId = null;
    }

    if (!patientId) {
      setLoading(false);
      return;
    }

    fetch(`http://localhost:3001/document/patient/${patientId}`)
      .then((res) => res.json())
      .then((data) => {
        setDocuments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setDocuments([]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-6">Chargement…</p>;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* 🔙 RETOUR */}
      <button
        onClick={() => router.push("/patient/dashboard")}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-2xl font-bold mb-6">Mes documents</h1>

      {documents.length === 0 ? (
        <p>Aucun document disponible.</p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const cible = doc.proche
              ? `Pour ${doc.proche.prenom} ${doc.proche.nom} – ${doc.proche.relation}`
              : "Pour moi";

            return (
              <div
                key={doc.id}
                className="bg-white p-5 rounded-xl shadow border border-gray-200 flex justify-between items-center"
              >
                <div className="space-y-1">
                  <h2 className="font-semibold">{doc.type}</h2>

                  {/* 🎯 CIBLE */}
                  <p className="text-sm text-gray-700">{cible}</p>

                  {/* 📅 DATE */}
                  <p className="text-gray-500 text-sm">
                    Ajouté le{" "}
                    {doc.createdAt
                      ? new Date(doc.createdAt).toLocaleDateString("fr-FR")
                      : ""}
                  </p>

                  {/* 🧑‍⚕️ MÉDECIN */}
                  {doc.medecin && (
                    <p className="text-xs text-gray-500">
                      Ajouté par Dr {doc.medecin.prenom} {doc.medecin.nom}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => openDocument(doc.url)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                >
                  Voir
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
