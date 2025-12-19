"use client";

import { useEffect, useState } from "react";

export default function PatientDocumentsList({
  patientId,
  procheId,
}: {
  patientId: number;
  procheId?: number | null;
}) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/document/patient/${patientId}`
    );
    const data = await res.json();

    let filtered = Array.isArray(data) ? data : [];

    /* 🔥 FILTRAGE MÉTIER CÔTÉ MÉDECIN */
    if (procheId) {
      // ➜ mode proche : uniquement les docs de CE proche
      filtered = filtered.filter(
        (d) => d.proche && d.proche.id === procheId
      );
    } else {
      // ➜ mode patient : uniquement les docs du patient (pas ceux des proches)
      filtered = filtered.filter(
        (d) => d.patientId !== null
      );
    }

    setDocs(filtered);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [patientId, procheId]);

  const remove = async (id: number) => {
    if (!confirm("Supprimer ce document ?")) return;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/document/${id}`,
      { method: "DELETE" }
    );

    load();
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Chargement des documents…</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-2">Documents existants</h3>

      {docs.length === 0 && (
        <p className="text-sm text-gray-500">Aucun document.</p>
      )}

      <ul className="space-y-2">
        {docs.map((d) => (
          <li
            key={d.id}
            className="flex justify-between items-center border p-3 rounded"
          >
            <div>
              <a
                href={d.url}
                target="_blank"
                className="text-blue-600 underline font-medium"
              >
                {d.type}
              </a>

              <div className="text-xs text-gray-500">
                Ajouté le{" "}
                {d.createdAt
                  ? new Date(d.createdAt).toLocaleDateString("fr-FR")
                  : "-"}
              </div>

              {d.proche && (
                <div className="text-xs text-gray-500">
                  Proche : {d.proche.prenom} {d.proche.nom}
                </div>
              )}
            </div>

            <button
              onClick={() => remove(d.id)}
              className="text-red-600 text-sm"
            >
              🗑️ Supprimer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
