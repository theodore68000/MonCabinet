'use client';

import { useState } from 'react';

export default function FormulaireClient({
  rdvId,
  initialData,
}: {
  rdvId: number;
  initialData: any;
}) {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    symptomes: initialData?.symptomes || '',
    debutSymptomes: initialData?.debutSymptomes || '',
    douleur: initialData?.douleur || 0,
    antecedents: initialData?.antecedents || '',
    allergies: initialData?.allergies || '',
    medicaments: initialData?.medicaments || '',
    grossesse: initialData?.grossesse || '',
    questions: initialData?.questions || '',
  });

  const update = (key: string, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const submit = async () => {
    setLoading(true);

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/formulaire/${rdvId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (res.ok) {
      alert('Formulaire envoyé avec succès !');
      return;
    }

    alert('Erreur lors de l’envoi du formulaire.');
  };

  return (
    <div className="space-y-6">

      {/* Symptômes */}
      <div>
        <label className="font-medium">Symptômes *</label>
        <textarea
          className="w-full border p-2 rounded mt-1"
          rows={3}
          value={form.symptomes}
          onChange={(e) => update('symptomes', e.target.value)}
        />
      </div>

      {/* Début des symptômes */}
      <div>
        <label className="font-medium">Début des symptômes (optionnel)</label>
        <input
          type="date"
          className="w-full border p-2 rounded mt-1"
          value={form.debutSymptomes}
          onChange={(e) => update('debutSymptomes', e.target.value)}
        />
      </div>

      {/* Douleur */}
      <div>
        <label className="font-medium">
          Niveau de douleur (0 = aucune, 10 = maximum)
        </label>
        <input
          type="range"
          min="0"
          max="10"
          value={form.douleur}
          onChange={(e) => update('douleur', Number(e.target.value))}
        />
        <div className="text-sm text-gray-600">Douleur : {form.douleur} / 10</div>
      </div>

      {/* Antécédents */}
      <div>
        <label className="font-medium">Antécédents médicaux</label>
        <textarea
          className="w-full border p-2 rounded mt-1"
          rows={3}
          value={form.antecedents}
          onChange={(e) => update('antecedents', e.target.value)}
        />
      </div>

      {/* Allergies */}
      <div>
        <label className="font-medium">Allergies</label>
        <input
          className="w-full border p-2 rounded mt-1"
          value={form.allergies}
          onChange={(e) => update('allergies', e.target.value)}
        />
      </div>

      {/* Médicaments */}
      <div>
        <label className="font-medium">Médicaments en cours</label>
        <textarea
          className="w-full border p-2 rounded mt-1"
          rows={2}
          value={form.medicaments}
          onChange={(e) => update('medicaments', e.target.value)}
        />
      </div>

      {/* Grossesse */}
      <div>
        <label className="font-medium">Grossesse</label>
        <select
          className="w-full border p-2 rounded mt-1"
          value={form.grossesse}
          onChange={(e) => update('grossesse', e.target.value)}
        >
          <option value="">Non concerné(e)</option>
          <option value="oui">Oui</option>
          <option value="non">Non</option>
        </select>
      </div>

      {/* Questions */}
      <div>
        <label className="font-medium">Questions au médecin</label>
        <textarea
          className="w-full border p-2 rounded mt-1"
          rows={2}
          value={form.questions}
          onChange={(e) => update('questions', e.target.value)}
        />
      </div>

      {/* Submit */}
      <button
        onClick={submit}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Envoi…' : 'Envoyer'}
      </button>
    </div>
  );
}
