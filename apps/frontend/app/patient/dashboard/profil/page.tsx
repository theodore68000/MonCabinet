"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import EditModal from "./EditModal";
import PasswordModal from "./PasswordModal";

type EditableField = "email" | "telephone" | "adresse" | "password";

export default function PatientProfilPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [patient, setPatient] = useState<any>(null);
  const [selectedField, setSelectedField] = useState<EditableField | null>(null);

  // modifications en attente (email/tel/adresse)
  const [pendingChanges, setPendingChanges] = useState<Partial<Record<EditableField, any>>>({});

  const getId = () => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("id="));
    return cookie ? cookie.split("=")[1] : null;
  };

  useEffect(() => {
    const id = getId();
    if (!id) {
      setLoading(false);
      return;
    }

    fetch(`http://localhost:3001/patient/${id}`)
      .then((res) => res.json())
      .then((data) => setPatient(data))
      .finally(() => setLoading(false));
  }, []);

  const editableFields = useMemo(
    () => [
      { key: "email" as const, label: "Email" },
      { key: "telephone" as const, label: "Téléphone" },
      { key: "adresse" as const, label: "Adresse" },
      { key: "password" as const, label: "Mot de passe" },
    ],
    []
  );

  const hasPending = useMemo(() => {
    return (
      pendingChanges.email !== undefined ||
      pendingChanges.telephone !== undefined ||
      pendingChanges.adresse !== undefined
    );
  }, [pendingChanges]);

  const getDisplayedValue = (key: EditableField) => {
    if (!patient) return "—";
    if (key === "password") return "••••••••";

    const pending = pendingChanges[key];
    const val = pending !== undefined ? pending : patient[key];

    return val ?? <span className="text-gray-400">—</span>;
  };

  const handleSaveAll = async () => {
    const id = getId();
    if (!id) return alert("Session invalide (id manquant).");

    const payload: any = {};
    if (pendingChanges.email !== undefined) payload.email = pendingChanges.email;
    if (pendingChanges.telephone !== undefined) payload.telephone = pendingChanges.telephone; // digits only
    if (pendingChanges.adresse !== undefined) payload.adresse = pendingChanges.adresse;

    if (Object.keys(payload).length === 0) return;

    try {
      setSaving(true);

      const res = await fetch(`http://localhost:3001/patient/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("Erreur backend:", err);
        alert("Erreur lors de l’enregistrement.");
        return;
      }

      setPatient((prev: any) => ({ ...prev, ...payload }));
      setPendingChanges({});
      alert("Profil enregistré.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!patient) return <div>Erreur chargement patient</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <button
        onClick={() => router.push("/patient/dashboard")}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au dashboard
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mon profil</h1>
          <p className="text-gray-600 text-sm">
            Modifie puis clique sur Enregistrer.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={!hasPending || saving}
          className={`px-4 py-2 rounded text-white ${
            !hasPending || saving
              ? "bg-blue-600 opacity-50 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
          title={!hasPending ? "Aucune modification" : "Enregistrer les modifications"}
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>

      <div className="space-y-4">
        {editableFields.map((f) => (
          <div
            key={f.key}
            className="border p-4 rounded-lg hover:bg-gray-50 cursor-pointer transition"
            onClick={() => setSelectedField(f.key)}
          >
            <label className="text-sm text-gray-500">{f.label}</label>
            <div className="text-lg">{getDisplayedValue(f.key)}</div>

            {(f.key === "email" || f.key === "telephone" || f.key === "adresse") &&
              pendingChanges[f.key] !== undefined && (
                <div className="text-xs text-blue-600 mt-1">Modification en attente</div>
              )}
          </div>
        ))}
      </div>

      {/* MODAL EDIT (stocke en pending, ne patch pas) */}
      {selectedField && selectedField !== "password" && (
        <EditModal
          field={selectedField}
          value={
            pendingChanges[selectedField] !== undefined
              ? pendingChanges[selectedField]
              : patient[selectedField]
          }
          onClose={() => setSelectedField(null)}
          onSave={(newValue: any) => {
            setPendingChanges((prev) => ({ ...prev, [selectedField]: newValue }));
            setSelectedField(null);
          }}
        />
      )}

      {/* MOT DE PASSE (patch dédié) */}
      {selectedField === "password" && (
        <PasswordModal
          onClose={() => setSelectedField(null)}
          onSave={async (payload: any) => {
            const id = getId();
            if (!id) return alert("Session invalide (id manquant).");

            const res = await fetch(`http://localhost:3001/patient/${id}/password`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const err = await res.text();
              console.error("Erreur backend:", err);
              return alert("Erreur lors de la mise à jour du mot de passe.");
            }

            alert("Mot de passe mis à jour");
            setSelectedField(null);
          }}
        />
      )}
    </div>
  );
}
