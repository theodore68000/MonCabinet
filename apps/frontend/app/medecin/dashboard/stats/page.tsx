import Link from "next/link";
import StatsPageClient from "./stats-client";

async function fetchStats() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;
  const medecinId = 1;

  const url = `${API_URL}/medecin/${medecinId}/stats`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("❌ Erreur lors de la récupération des stats");
    console.error("URL :", url);
    console.error("Status :", res.status);
    console.error("Body :", await res.text());
    throw new Error("Erreur de récupération des stats.");
  }

  return res.json();
}

export default async function StatsPage() {
  const stats = await fetchStats();

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* 🔙 RETOUR DASHBOARD */}
      <Link
        href="/medecin/dashboard"
        className="inline-block px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
      >
        ← Retour au dashboard
      </Link>

      <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">
        Statistiques de mon activité
      </h1>

      <p className="text-sm text-gray-500">
        Vue synthétique de ton activité médicale.
      </p>

      <StatsPageClient stats={stats} />
    </div>
  );
}
