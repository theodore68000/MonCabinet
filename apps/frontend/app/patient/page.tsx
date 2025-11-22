'use client';

import { useEffect, useState } from 'react';

interface Patient {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  anneeNaissance?: number;
  medecinTraitant?: { id: number; nom: string; prenom: string };
  adresse?: string;
  motDePasse?: string;
}

interface Medecin {
  id: number;
  nom: string;
  prenom: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [showPassword, setShowPassword] = useState<number | null>(null);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    anneeNaissance: '',
    medecinTraitantId: '',
    adresse: '',
  });

  // Charger patients + médecins
  useEffect(() => {
    fetch('http://localhost:3001/patient')
      .then(res => res.json())
      .then(data => setPatients(data));

    fetch('http://localhost:3001/medecin')
      .then(res => res.json())
      .then(data => setMedecins(data));
  }, []);

  // Ajouter un patient
  const addPatient = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch('http://localhost:3001/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        anneeNaissance: form.anneeNaissance ? Number(form.anneeNaissance) : null,
        medecinTraitantId: form.medecinTraitantId ? Number(form.medecinTraitantId) : null,
      }),
    });

    if (res.ok) {
      const newPatient = await res.json();
      setPatients([...patients, newPatient]);

      setForm({
        nom: '',
        prenom: '',
        email: '',
        telephone: '',
        anneeNaissance: '',
        medecinTraitantId: '',
        adresse: '',
      });
    } else {
      alert("Impossible d'ajouter le patient !");
    }
  };

  // SUPPRESSION PATIENT
  const deletePatient = async (id: number) => {
    if (!confirm("Supprimer ce patient ?")) return;

    const res = await fetch(`http://localhost:3001/patient/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      setPatients(patients.filter(p => p.id !== id));
    }
  };

  // ÉDITION INLINE
  const updateField = async (id: number, field: string, value: string | number | null) => {
    const res = await fetch(`http://localhost:3001/patient/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });

    if (res.ok) {
      const updated = await res.json();
      setPatients(patients.map(p => (p.id === id ? updated : p)));
    }
  };

  // Composant cellule éditable
  const EditableCell = ({
    value,
    onChange,
  }: {
    value: any;
    onChange: (v: any) => void;
  }) => {
    const [editing, setEditing] = useState(false);
    const [temp, setTemp] = useState(value);

    return (
      <td
        className="p-2 cursor-pointer"
        onClick={() => setEditing(true)}
      >
        {editing ? (
          <input
            autoFocus
            value={temp ?? ''}
            onChange={(e) => setTemp(e.target.value)}
            onBlur={() => { setEditing(false); onChange(temp); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditing(false);
                onChange(temp);
              }
            }}
            className="border px-1 rounded"
          />
        ) : (
          value || '-'
        )}
      </td>
    );
  };

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">👨‍👩‍👧 Patients du cabinet</h1>

      {/* FORMULAIRE */}
      <form onSubmit={addPatient} className="flex flex-wrap gap-3 mb-6">
        <input
          placeholder="Nom"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
          className="border p-2 rounded flex-1"
          required
        />
        <input
          placeholder="Prénom"
          value={form.prenom}
          onChange={(e) => setForm({ ...form, prenom: e.target.value })}
          className="border p-2 rounded flex-1"
          required
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border p-2 rounded flex-1"
          required
        />
        <input
          placeholder="Téléphone"
          value={form.telephone}
          onChange={(e) => setForm({ ...form, telephone: e.target.value })}
          className="border p-2 rounded flex-1"
        />
        <input
          placeholder="Année de naissance"
          type="number"
          value={form.anneeNaissance}
          onChange={(e) => setForm({ ...form, anneeNaissance: e.target.value })}
          className="border p-2 rounded w-40"
        />

        <input
          placeholder="Adresse"
          value={form.adresse}
          onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          className="border p-2 rounded flex-1"
        />

        <select
          value={form.medecinTraitantId}
          onChange={(e) => setForm({ ...form, medecinTraitantId: e.target.value })}
          className="border p-2 rounded w-60"
        >
          <option value="">-- Médecin traitant --</option>
          {medecins.map((m) => (
            <option key={m.id} value={m.id}>
              Dr {m.prenom} {m.nom}
            </option>
          ))}
        </select>

        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Ajouter
        </button>
      </form>

      {/* TABLEAU */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Nom</th>
            <th>Prénom</th>
            <th>Email</th>
            <th>Téléphone</th>
            <th>Année</th>
            <th>Médecin traitant</th>
            <th>Adresse</th>
            <th>Mot de passe</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <EditableCell value={p.nom} onChange={(v) => updateField(p.id, 'nom', v)} />
              <EditableCell value={p.prenom} onChange={(v) => updateField(p.id, 'prenom', v)} />
              <EditableCell value={p.email} onChange={(v) => updateField(p.id, 'email', v)} />
              <EditableCell value={p.telephone} onChange={(v) => updateField(p.id, 'telephone', v)} />
              <EditableCell value={p.anneeNaissance} onChange={(v) => updateField(p.id, 'anneeNaissance', Number(v))} />

              {/* Médecin traitant */}
              <td className="p-2">
                <select
                  value={p.medecinTraitant?.id ?? ''}
                  onChange={(e) =>
                    updateField(p.id, 'medecinTraitantId', Number(e.target.value))
                  }
                  className="border p-1 rounded"
                >
                  <option value="">-</option>
                  {medecins.map((m) => (
                    <option key={m.id} value={m.id}>
                      Dr {m.prenom} {m.nom}
                    </option>
                  ))}
                </select>
              </td>

              <EditableCell value={p.adresse} onChange={(v) => updateField(p.id, 'adresse', v)} />

              {/* Mot de passe */}
              <td className="p-2">
                {showPassword === p.id ? p.motDePasse : '••••••'}
                <button
                  className="ml-2 text-blue-600"
                  onClick={() => setShowPassword(showPassword === p.id ? null : p.id)}
                >
                  👁️
                </button>
              </td>

              {/* SUPPRESSION */}
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
