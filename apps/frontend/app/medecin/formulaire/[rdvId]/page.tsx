import Link from "next/link";

export default async function MedecinFormulairePage({
  params,
}: {
  params: Promise<{ rdvId: string }>;
}) {
  // 🔥 OBLIGATOIRE SUR NEXT 15/16
  const { rdvId: rdvParam } = await params;

  const rdvId = Number(rdvParam);
  const rdvIdDisplay = isNaN(rdvId) ? "?" : String(rdvId);

  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  // Récupération du formulaire
  const res = await fetch(`${api}/formulaire/${rdvId}`, {
    cache: "no-store",
  });

  const data = res.ok ? await res.json() : null;
  const reponses = data?.reponses ?? null;

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      {/* 🔙 RETOUR DASHBOARD */}
      <Link
        href="/medecin/dashboard"
        className="inline-block mb-6 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition"
      >
        ← Retour au dashboard
      </Link>

      <h1 className="text-3xl font-bold text-emerald-400 mb-6">
        Formulaire — Patient
      </h1>

      <p className="text-slate-400 mb-4">
        Rendez-vous n°{" "}
        <span className="text-slate-200 font-semibold">{rdvIdDisplay}</span>
      </p>

      {!reponses && (
        <p className="text-red-400 italic">
          Le patient n’a pas encore rempli ce formulaire.
        </p>
      )}

      {reponses && (
        <div className="space-y-6 bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-xl">
          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Symptômes
            </h3>
            <p className="text-slate-300 whitespace-pre-wrap">
              {reponses.symptomes || "—"}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Début des symptômes
            </h3>
            <p className="text-slate-300">
              {reponses.debutSymptomes || "—"}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Douleur
            </h3>
            <p className="text-slate-300">{reponses.douleur ?? "—"} / 10</p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Antécédents
            </h3>
            <p className="text-slate-300 whitespace-pre-wrap">
              {reponses.antecedents || "—"}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Allergies
            </h3>
            <p className="text-slate-300 whitespace-pre-wrap">
              {reponses.allergies || "—"}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Médicaments
            </h3>
            <p className="text-slate-300 whitespace-pre-wrap">
              {reponses.medicaments || "—"}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Grossesse
            </h3>
            <p className="text-slate-300">
              {reponses.grossesse || "—"}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-emerald-300">
              Questions du patient
            </h3>
            <p className="text-slate-300 whitespace-pre-wrap">
              {reponses.questions || "—"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
