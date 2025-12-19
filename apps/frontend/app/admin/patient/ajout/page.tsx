"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────── */
/* TYPES */
/* ─────────────────────────────────────────────── */
interface Patient {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  dateNaissance: string; // dd/mm/yyyy
  motDePasse?: string;
}

/* ─────────────────────────────────────────────── */
/* UTILS FORMAT */
/* ─────────────────────────────────────────────── */
const formatNom = (v: string) => v.toUpperCase();

const formatPrenom = (v: string) =>
  v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : "";

const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4)
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const isValidDate = (v: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(v);

/* ─────────────────────────────────────────────── */
/* PAGE */
/* ─────────────────────────────────────────────── */
export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showPassword, setShowPassword] = useState<number | null>(null);

  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    dateNaissance: "",
    email: "",
    motDePasse: "",
  });

  /* ─────────────────────────────────────────────── */
  /* LOAD */
  /* ─────────────────────────────────────────────── */
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    const res = await fetch("http://localhost:3001/patient");
    const data = await res.json();
    setPatients((data || []).filter((p: any) => typeof p.id === "number"));
  };

  /* ─────────────────────────────────────────────── */
  /* ADD */
  /* ─────────────────────────────────────────────── */
  const addPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidDate(form.dateNaissance)) {
      alert("Date invalide (dd/mm/yyyy)");
      return;
    }

    const payload = {
      nom: formatNom(form.nom),
      prenom: formatPrenom(form.prenom),
      dateNaissance: form.dateNaissance,
      email: form.email,
      motDePasse: form.motDePasse,
    };

    const res = await fetch("http://localhost:3001/patient/admin-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Erreur lors de la création du patient");
      return;
    }

    const created = await res.json();
    setPatients((prev) => [...prev, created]);

    setForm({
      nom: "",
      prenom: "",
      dateNaissance: "",
      email: "",
      motDePasse: "",
    });
  };

  /* ─────────────────────────────────────────────── */
  /* DELETE */
/* ─────────────────────────────────────────────── */
  const deletePatient = async (id: number) => {
    if (!confirm("Supprimer ce patient ?")) return;

    const res = await fetch(`http://localhost:3001/patient/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setPatients((prev) => prev.filter((p) => p.id !== id));
    }
  };

  /* ─────────────────────────────────────────────── */
  /* UPDATE */
/* ─────────────────────────────────────────────── */
  const updateField = async (
    id: number,
    field: string,
    value: string
  ) => {
    const res = await fetch(`http://localhost:3001/patient/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });

    if (!res.ok) return;

    const updated = await res.json();
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? updated : p))
    );
  };

  /* ─────────────────────────────────────────────── */
  /* CELL */
/* ─────────────────────────────────────────────── */
  const EditableCell = ({
    value,
    onSave,
    formatter,
  }: {
    value: string;
    onSave: (v: string) => void;
    formatter?: (v: string) => string;
  }) => {
    const [editing, setEditing] = useState(false);
    const [temp, setTemp] = useState(value ?? "");

    return (
      <td className="p-2 cursor-pointer" onClick={() => setEditing(true)}>
        {editing ? (
          <input
            autoFocus
            value={temp}
            onChange={(e) =>
              setTemp(formatter ? formatter(e.target.value) : e.target.value)
            }
            onBlur={() => {
              setEditing(false);
              onSave(temp);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setEditing(false);
                onSave(temp);
              }
            }}
            className="border px-1 rounded w-full"
          />
        ) : (
          value || "-"
        )}
      </td>
    );
  };

  /* ─────────────────────────────────────────────── */
  /* RENDER */
/* ─────────────────────────────────────────────── */
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Patients</h1>

      {/* FORM */}
      <form onSubmit={addPatient} className="flex gap-3 mb-6 flex-wrap">
        <input
          placeholder="Nom"
          value={form.nom}
          onChange={(e) =>
            setForm({ ...form, nom: formatNom(e.target.value) })
          }
          className="border p-2 rounded"
          required
        />

        <input
          placeholder="Prénom"
          value={form.prenom}
          onChange={(e) =>
            setForm({ ...form, prenom: formatPrenom(e.target.value) })
          }
          className="border p-2 rounded"
          required
        />

        <input
          placeholder="Date de naissance (dd/mm/yyyy)"
          value={form.dateNaissance}
          onChange={(e) =>
            setForm({
              ...form,
              dateNaissance: formatDateInput(e.target.value),
            })
          }
          className="border p-2 rounded w-56"
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) =>
            setForm({ ...form, email: e.target.value })
          }
          className="border p-2 rounded"
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={form.motDePasse}
          onChange={(e) =>
            setForm({ ...form, motDePasse: e.target.value })
          }
          className="border p-2 rounded"
          required
        />

        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Ajouter
        </button>
      </form>

      {/* TABLE */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Nom</th>
            <th>Prénom</th>
            <th>Date naissance</th>
            <th>Email</th>
            <th>Mot de passe</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {patients.map((p) => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <EditableCell
                value={p.nom}
                formatter={formatNom}
                onSave={(v) => updateField(p.id, "nom", formatNom(v))}
              />
              <EditableCell
                value={p.prenom}
                formatter={formatPrenom}
                onSave={(v) => updateField(p.id, "prenom", formatPrenom(v))}
              />
              <EditableCell
                value={p.dateNaissance}
                formatter={formatDateInput}
                onSave={(v) => {
                  if (isValidDate(v)) {
                    updateField(p.id, "dateNaissance", v);
                  } else {
                    alert("Date invalide (dd/mm/yyyy)");
                  }
                }}
              />
              <EditableCell
                value={p.email}
                onSave={(v) => updateField(p.id, "email", v)}
              />

              <td className="p-2">
                {showPassword === p.id ? p.motDePasse : "••••••"}
                <button
                  className="ml-2"
                  onClick={() =>
                    setShowPassword(showPassword === p.id ? null : p.id)
                  }
                >
                  👁️
                </button>
              </td>

              <td className="p-2">
                <button
                  onClick={() => deletePatient(p.id)}
                  className="text-red-600 text-xl"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
