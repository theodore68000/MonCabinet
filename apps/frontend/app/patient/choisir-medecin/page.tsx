"use client";

import { useEffect, useState } from "react";
import AddFavoriInput from "./components/AddFavoriInput";
import FavorisList from "./components/FavorisList";
import { useRouter } from "next/navigation";

export default function ChoisirMedecinPage() {
  const router = useRouter();

  const [patientId, setPatientId] = useState<number | null>(null);
  const [favoris, setFavoris] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= PATIENT CONTEXT ================= */
  useEffect(() => {
    const raw = localStorage.getItem("patientSession");
    if (!raw) return;

    try {
      const session = JSON.parse(raw);
      if (session?.id) {
        setPatientId(session.id);
      }
    } catch {}
  }, []);

  /* ================= LOAD FAVORIS ================= */
  const loadFavoris = async (pid: number) => {
    setLoading(true);

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/patient/${pid}/favoris`,
      { cache: "no-store" } // 🔥 évite cache navigateur
    );

    const data = await res.json();

    setFavoris((data || []).map((f: any) => f.medecin));
    setLoading(false);
  };

  useEffect(() => {
    if (patientId) {
      loadFavoris(patientId);
    }
  }, [patientId]);

  /* ================= ACTIONS ================= */
  const addFavori = async (medecin: any) => {
    if (!patientId) return;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/patient/${patientId}/favoris`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medecinId: medecin.id }),
      }
    );

    await loadFavoris(patientId);
  };

  const removeFavori = async (medecinId: number) => {
    if (!patientId) return;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/patient/${patientId}/favoris/${medecinId}`,
      { method: "DELETE" }
    );

    await loadFavoris(patientId);
  };

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen w-full bg-white p-8">
      <button
        onClick={() => router.push("/patient/dashboard")}
        className="mb-6 px-4 py-2 bg-gray-200 rounded"
      >
        ← Retour au tableau de bord
      </button>

      <h1 className="text-2xl font-bold mb-6">Médecins favoris</h1>

      {loading ? (
        <p>Chargement…</p>
      ) : (
        <FavorisList favoris={favoris} removeFavori={removeFavori} />
      )}

      <div className="mt-6 max-w-md">
        <AddFavoriInput onAdd={addFavori} />
      </div>
    </div>
  );
}
