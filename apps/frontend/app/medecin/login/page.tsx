// app/medecin/page.tsx

import Link from "next/link";

export default function MedecinLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-slate-800">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#22c55e33,_transparent_60%)]" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-20 pt-16 lg:flex-row lg:items-center lg:pt-24">
          {/* Texte */}
          <div className="flex-1 space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              🩺 Spécial médecins libéraux
            </span>
            <h1 className="text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              La plateforme qui{" "}
              <span className="text-emerald-400">simplifie enfin</span>{" "}
              votre quotidien de médecin.
            </h1>
            <p className="max-w-xl text-sm text-slate-300 sm:text-base">
              Planning intelligent, prise de rendez-vous en ligne, gestion des
              patients&nbsp;: tout est centralisé, sans tableur, sans appels
              perdus, sans prise de tête.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="#tarifs"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-medium text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
              >
                Voir les tarifs & s’abonner
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              >
                Découvrir les fonctionnalités
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400 sm:text-sm">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">●</span> Sans engagement
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">●</span> Mise en route en
                moins de 10 minutes
              </div>
            </div>
          </div>

          {/* Aperçu interface */}
          <div className="flex-1">
            <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-emerald-500/20 backdrop-blur">
              <div className="mb-4 flex items-center justify-between text-xs text-slate-400">
                <span>Planning du jour</span>
                <span>Cabinet Dr. Martin</span>
              </div>
              <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 text-xs">
                {[
                  { heure: "08:30", patient: "Consultation – suivi", status: "Confirmé" },
                  { heure: "09:00", patient: "Nouveau patient", status: "À confirmer" },
                  { heure: "10:15", patient: "Visite contrôle", status: "Confirmé" },
                  { heure: "11:45", patient: "Téléconsultation", status: "Confirmé" },
                  { heure: "14:00", patient: "Consultation enfant", status: "Confirmé" },
                  { heure: "16:15", patient: "Suivi traitement", status: "Confirmé" },
                ].map((rdv, i) => (
                  <FragmentRow key={i} {...rdv} />
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-3 text-xs">
                <div>
                  <p className="text-slate-300">+1h01 gagnée aujourd’hui</p>
                  <p className="text-slate-500">
                    sur la gestion des appels et rendez-vous
                  </p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-medium text-emerald-300">
                  Planning optimisé
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-24 px-6 py-16">
        {/* Features */}
        <section id="features" className="space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Tout ce dont vous avez besoin,{" "}
              <span className="text-emerald-400">inclus dans l’abonnement.</span>
            </h2>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Une seule plateforme pour gérer votre cabinet, vos patients et
              votre planning. Sans formation complexe, sans installation.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              title="Planning intelligent"
              icon="📅"
              items={[
                "Créneaux automatiques (15 minutes)",
                "Vue jour & semaine FullCalendar",
                "Gestion des absences & indisponibilités",
                "Week-end géré automatiquement",
              ]}
            />
            <FeatureCard
              title="Rendez-vous automatisés"
              icon="⚙️"
              items={[
                "Prise de RDV en ligne par vos patients",
                "Limite à 1 RDV futur par patient",
                "Moins d’appels au secrétariat",
                "Rafraîchissement en temps réel",
              ]}
            />
            <FeatureCard
              title="Dossiers patients simplifiés"
              icon="👤"
              items={[
                "Infos essentielles en un coup d’œil",
                "Médecin traitant défini",
                "Historique des rendez-vous",
                "Accès rapide depuis le planning",
              ]}
            />
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Un tarif clair, pensé pour les médecins.
            </h2>
            <p className="mx-auto max-w-2xl text-sm text-slate-300 sm:text-base">
              Pas de frais cachés, pas de surprise. Vous payez un abonnement
              simple pour une plateforme complète et évolutive.
            </p>
          </div>

          <div className="mx-auto max-w-xl rounded-3xl border border-emerald-500/40 bg-slate-900/70 p-8 shadow-xl shadow-emerald-500/20">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              Offre recommandée
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-semibold text-emerald-400">
                29,90 €
              </span>
              <span className="text-sm text-slate-400">/ mois TTC</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              Abonnement unique par médecin, accès illimité et mises à jour
              incluses.
            </p>

            <ul className="mt-6 space-y-2 text-sm text-slate-200">
              {[
                "Planning intelligent illimité",
                "Gestion complète des patients",
                "Création & suivi des rendez-vous",
                "Historique des consultations",
                "Accès web (cabinet, télétravail, domicile)",
                "Support prioritaire par email",
                "Mises à jour & nouveautés incluses",
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/medecin/register"
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
              >
                Créer mon compte médecin
              </Link>
              <p className="text-xs text-slate-400">
                Sans engagement. Annulation possible à tout moment.
              </p>
            </div>
          </div>
        </section>

        {/* Témoignages */}
        <section id="temoignages" className="space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Ils l’ont testé,{" "}
              <span className="text-emerald-400">et l’ont adopté.</span>
            </h2>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Des médecins de différentes spécialités utilisent déjà la
              plateforme au quotidien pour reprendre le contrôle sur leur
              planning.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <TestimonialCard
              name="Dr. Claire Dupont"
              role="Médecin généraliste"
              quote="Mon planning est enfin sous contrôle. Les patients prennent eux-mêmes leurs rendez-vous, et je passe moins de temps au téléphone."
            />
            <TestimonialCard
              name="Dr. Julien Martin"
              role="Cardiologue"
              quote="En quelques jours, j’ai gagné plus d’une heure par jour. La gestion automatique des créneaux me change la vie."
            />
            <TestimonialCard
              name="Dr. Sofia Lopez"
              role="Pédiatre"
              quote="Interface claire, rapide, pensée pour la pratique. Je recommande à mes confrères sans hésiter."
            />
          </div>
        </section>

        {/* Arguments rassurance */}
        <section className="space-y-10">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Pensé pour la médecine,{" "}
              <span className="text-emerald-400">pas pour l’administratif.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <RassuranceCard
              title="🔐 Sécurité & confidentialité"
              text="Données hébergées en Europe, conformes au RGPD. Accès sécurisé, gestion des comptes et des permissions."
            />
            <RassuranceCard
              title="⚡ Performance & fiabilité"
              text="Architecture moderne (NestJS, Next.js, PostgreSQL, Prisma, FullCalendar). Une application rapide et robuste."
            />
            <RassuranceCard
              title="📞 Support humain"
              text="Vous n’êtes pas seul. On vous accompagne dans la mise en place et l’utilisation au quotidien."
            />
          </div>
        </section>

        {/* CTA final */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 px-8 py-10 text-center shadow-lg shadow-slate-900/50">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Prêt à reprendre le contrôle sur votre planning ?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Créez votre compte médecin, configurez vos horaires, et laissez vos
            patients réserver leurs créneaux en ligne. Vous concentrez votre
            énergie là où elle compte vraiment&nbsp;: auprès d’eux.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/medecin/register"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
            >
              Créer mon compte médecin
            </Link>
            <Link
              href="#tarifs"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Voir le détail des tarifs
            </Link>
          </div>
        </section>
      </main>

      {/* Footer simple */}
      <footer className="border-t border-slate-900 bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Cabinet Médical – Espace médecin</p>
          <div className="flex gap-4">
            <button className="hover:text-slate-300">Mentions légales</button>
            <button className="hover:text-slate-300">Confidentialité</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

type FeatureCardProps = {
  title: string;
  icon: string;
  items: string[];
};

function FeatureCard({ title, icon, items }: FeatureCardProps) {
  return (
    <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-950/40">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-50 sm:text-base">
          {title}
        </h3>
      </div>
      <ul className="space-y-1.5 text-xs text-slate-300 sm:text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-400">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type TestimonialCardProps = {
  name: string;
  role: string;
  quote: string;
};

function TestimonialCard({ name, role, quote }: TestimonialCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-950/40">
      <p className="mb-4 text-sm text-slate-200">“{quote}”</p>
      <div className="mt-auto pt-2 text-xs text-slate-400">
        <p className="font-medium text-slate-100">{name}</p>
        <p>{role}</p>
      </div>
    </div>
  );
}

type RassuranceCardProps = {
  title: string;
  text: string;
};

function RassuranceCard({ title, text }: RassuranceCardProps) {
  return (
    <div className="h-full rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-950/40">
      <h3 className="mb-2 text-sm font-semibold text-slate-50 sm:text-base">
        {title}
      </h3>
      <p className="text-xs text-slate-300 sm:text-sm">{text}</p>
    </div>
  );
}

type FragmentRowProps = {
  heure: string;
  patient: string;
  status: string;
};

function FragmentRow({ heure, patient, status }: FragmentRowProps) {
  const isConfirmé = status.toLowerCase().includes("confirm");
  return (
    <>
      <div className="text-[11px] font-medium text-slate-400">{heure}</div>
      <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2">
        <div>
          <p className="text-xs text-slate-100">{patient}</p>
          <p className="text-[11px] text-slate-500">{status}</p>
        </div>
        <span
          className={`h-2 w-2 rounded-full ${
            isConfirmé ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
      </div>
    </>
  );
}
