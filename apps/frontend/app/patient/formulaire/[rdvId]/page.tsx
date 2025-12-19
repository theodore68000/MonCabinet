import FormulaireClient from "./FormulaireClient";

export default async function FormulairePage({
  params,
}: {
  params: Promise<{ rdvId: string }>;
}) {
  // 🔥 OBLIGATOIRE SUR NEXT 15/16
  const { rdvId: rdvParam } = await params;

  const rdvId = Number(rdvParam);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // On récupère le formulaire
  const res = await fetch(`${api}/formulaire/${rdvId}`, {
    cache: "no-store",
  });

  const data = res.ok ? await res.json() : null;

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-white">
      <h1 className="text-3xl font-semibold mb-6 text-emerald-400">
        Formulaire de pré-consultation
      </h1>

      <p className="text-slate-400 mb-4">
        Rendez-vous n°{" "}
        <span className="text-slate-200 font-semibold">{rdvId}</span>
      </p>

      <FormulaireClient rdvId={rdvId} initialData={data?.reponses ?? null} />
    </div>
  );
}
