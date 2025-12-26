import FormulaireClient from './FormulaireClient';
import type { RdvMotif } from '@/app/features/rdv/motifs';

export default async function FormulairePage({
  params,
}: {
  params: Promise<{ rdvId: string }>;
}) {
  const { rdvId: rdvParam } = await params;

  const rdvId = Number(rdvParam);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const res = await fetch(`${api}/formulaire/${rdvId}`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-xl font-semibold text-red-600">
          Formulaire introuvable
        </h1>
      </div>
    );
  }

  const data = await res.json();
  const motif = data?.rdv?.motif as RdvMotif | undefined;

  if (!motif) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <h1 className="text-xl font-semibold text-red-600">
          Motif du rendez-vous manquant
        </h1>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <h1 className="text-3xl font-semibold mb-6 text-emerald-400">
        Formulaire de pré-consultation
      </h1>

      <p className="text-slate-400 mb-6">
        Rendez-vous n°{' '}
        <span className="text-slate-200 font-semibold">{rdvId}</span>
      </p>

      <FormulaireClient
        rdvId={rdvId}
        motif={motif}
        initialData={data?.reponses ?? null}
      />
    </div>
  );
}
