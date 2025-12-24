"use client";

import { useEffect, useState } from "react";
import AddFavoriInput from "./components/AddFavoriInput";
import FavorisList from "./components/FavorisList";
import { useRouter } from "next/navigation";

const normalizeText = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function ChoisirMedecinPage() {
  const router = useRouter();

  /* ================= FAVORIS ================= */
  const [favoris, setFavoris] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("favorisMedecins");
    if (stored) {
      try {
        setFavoris(JSON.parse(stored));
      } catch {}
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem("favorisMedecins", JSON.stringify(favoris));
    }
  }, [favoris, loaded]);

  const addFavori = (m: any) => {
    setFavoris((prev) => {
      if (
        prev.some(
          (f) =>
            f.id === m.id ||
            normalizeText(`${f.prenom} ${f.nom}`) ===
              normalizeText(`${m.prenom} ${m.nom}`)
        )
      ) {
        return prev;
      }
      return [...prev, m];
    });
  };

  const removeFavori = (id: number) =>
    setFavoris((prev) => prev.filter((f) => f.id !== id));

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen w-full bg-white p-8">
      {/* RETOUR */}
      <button
        onClick={() => router.push("/patient/dashboard")}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au tableau de bord
      </button>

      {/* FAVORIS — FULL PAGE */}
      <h1 className="text-2xl font-bold mb-6">Médecins favoris</h1>

      {loaded ? (
        <FavorisList favoris={favoris} removeFavori={removeFavori} />
      ) : (
        <p>Chargement…</p>
      )}

      <div className="mt-6 max-w-md">
        <AddFavoriInput onAdd={addFavori} />
      </div>
    </div>
  );
}
