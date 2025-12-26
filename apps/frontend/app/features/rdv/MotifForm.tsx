'use client';

import { MOTIF_FORMS } from './motif-forms';
import type { RdvMotif } from './motifs';

type Props = {
  motif: RdvMotif;
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
};

export function MotifForm({ motif, value, onChange }: Props) {
  /**
   * Sécurisation du motif :
   * - si le motif existe dans MOTIF_FORMS → on l’utilise
   * - sinon → fallback "Autre"
   */
  const safeMotif =
    motif && motif in MOTIF_FORMS ? motif : 'Autre';

  /**
   * Sélection des champs :
   * - si le motif a des champs → on les affiche
   * - sinon → formulaire générique "Autre"
   */
  const fields =
    MOTIF_FORMS[safeMotif]?.length
      ? MOTIF_FORMS[safeMotif]!
      : MOTIF_FORMS.Autre!;

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">
            {field.label}
          </label>

          {field.type === 'textarea' && (
            <textarea
              className="w-full border p-2 rounded bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={value[field.key] ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  [field.key]: e.target.value,
                })
              }
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              className="w-full border p-2 rounded bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={value[field.key] ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  [field.key]: Number(e.target.value),
                })
              }
            />
          )}

          {field.type === 'text' && (
            <input
              type="text"
              className="w-full border p-2 rounded bg-white text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={value[field.key] ?? ''}
              onChange={(e) =>
                onChange({
                  ...value,
                  [field.key]: e.target.value,
                })
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}
