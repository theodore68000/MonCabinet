"use client";

import { useState } from "react";

export default function AddProcheModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    dateNaissance: "",
    relation: "",
  });

  const formatNom = (v: string) => v.toUpperCase();
  const formatPrenom = (v: string) =>
    v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "";

  const formatDate = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-xl space-y-4">
        <h2 className="text-xl font-semibold">Ajouter un proche</h2>

        <input
          placeholder="Nom (MAJUSCULE)"
          value={form.nom}
          onChange={(e) =>
            setForm({ ...form, nom: formatNom(e.target.value) })
          }
          className="border p-2 rounded w-full"
        />

        <input
          placeholder="Prénom"
          value={form.prenom}
          onChange={(e) =>
            setForm({ ...form, prenom: formatPrenom(e.target.value) })
          }
          className="border p-2 rounded w-full"
        />

        <input
          placeholder="Date de naissance (dd/mm/yyyy)"
          value={form.dateNaissance}
          onChange={(e) =>
            setForm({ ...form, dateNaissance: formatDate(e.target.value) })
          }
          className="border p-2 rounded w-full"
          maxLength={10}
        />

        <input
          placeholder="Lien (ex : fils, mère)"
          value={form.relation}
          onChange={(e) =>
            setForm({ ...form, relation: e.target.value })
          }
          className="border p-2 rounded w-full"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-200"
          >
            Annuler
          </button>

          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 rounded bg-blue-600 text-white"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
