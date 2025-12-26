'use client';

import { useState } from 'react';
import { MotifForm } from '../../../features/rdv/MotifForm';
import type { RdvMotif } from '../../../features/rdv/motifs';

export default function FormulaireClient({
  rdvId,
  motif,
  initialData,
}: {
  rdvId: number;
  motif: RdvMotif;
  initialData: Record<string, any> | null;
}) {
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>(
    initialData ?? {}
  );

  const submit = async () => {
    setLoading(true);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/formulaire/${rdvId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      }
    );

    setLoading(false);

    if (!res.ok) {
      alert('Erreur lors de l’envoi du formulaire.');
      return;
    }

    alert('Formulaire envoyé avec succès.');
  };

  return (
    <div className="space-y-6">
      <MotifForm
        motif={motif}
        value={answers}
        onChange={setAnswers}
      />

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
