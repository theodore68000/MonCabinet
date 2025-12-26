"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddProcheModal from "./AddProcheModal";
import EditProcheModal from "./EditProcheModal";

export default function ProchesPage() {
  const router = useRouter();

  const [proches, setProches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editProche, setEditProche] = useState<any | null>(null);

  const session =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("patientSession") || "{}")
      : null;

  const patientId = session?.id;

  const load = async () => {
    if (!patientId) return;

    setLoading(true);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/proches/patient/${patientId}`
    );
    const data = await res.json();
    setProches(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [patientId]);

  const addProche = async (form: any) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        nom: form.nom,
        prenom: form.prenom,
        relation: form.relation,
        dateNaissance: form.dateNaissance,
      }),
    });

    setShowAdd(false);
    load();
  };

  const updateProche = async (form: any) => {
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/proches/${editProche.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          relation: form.relation,
          dateNaissance: form.dateNaissance,
        }),
      }
    );

    setEditProche(null);
    load();
  };

  const deleteProche = async (id: number) => {
    if (!confirm("Supprimer ce proche ?")) return;

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/proches/${id}`, {
      method: "DELETE",
    });

    load();
  };

  if (loading) return <p className="p-6">Chargement…</p>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push("/patient/dashboard")}
          className="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          ← Retour au dashboard
        </button>
      </div>

      <h1 className="text-2xl font-bold">Mes proches</h1>

      <button
        onClick={() => setShowAdd(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        + Ajouter un proche
      </button>

      {proches.length === 0 && (
        <p className="text-gray-500">Aucun proche enregistré.</p>
      )}

      <ul className="space-y-3">
        {proches.map((p) => (
          <li
            key={p.id}
            className="border p-4 rounded flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">
                {p.prenom} {p.nom}
              </div>
              <div className="text-sm text-gray-600">
                Né(e) le{" "}
                {p.dateNaissance
                  ? new Date(p.dateNaissance).toLocaleDateString("fr-FR")
                  : "-"}{" "}
                — {p.relation}
              </div>
            </div>

            <div className="flex gap-3 items-center">
              <button
                onClick={() => setEditProche(p)}
                className="text-blue-600 text-sm"
              >
                Modifier
              </button>

              <button
                onClick={() => deleteProche(p.id)}
                className="text-red-600 text-lg"
                title="Supprimer"
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>

      {showAdd && (
        <AddProcheModal
          onClose={() => setShowAdd(false)}
          onSave={addProche}
        />
      )}

      {editProche && (
        <EditProcheModal
          proche={editProche}
          onClose={() => setEditProche(null)}
          onSave={updateProche}
        />
      )}
    </div>
  );
}
