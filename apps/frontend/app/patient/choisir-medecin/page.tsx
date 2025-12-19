"use client";

import { useEffect, useState } from "react";
import AddFavoriInput from "./components/AddFavoriInput";
import FavorisList from "./components/FavorisList";
import FiltersForm from "./components/FiltersForm";
import MedecinCard from "./components/MedecinCard";
import { useRouter } from "next/navigation";

// 🔧 AJOUT : normalisation texte (accents + casse)
const normalizeText = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function ChoisirMedecinPage() {
  const router = useRouter();

  // ------------------------------
  // ⭐ FAVORIS SAFE LOCAL STORAGE
  // ------------------------------
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
    if (!loaded) return;
    localStorage.setItem("favorisMedecins", JSON.stringify(favoris));
  }, [favoris, loaded]);

  // 🔧 AJOUT : éviter doublons accents/casse
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

  const removeFavori = (id: number) => {
    setFavoris((prev) => prev.filter((f) => f.id !== id));
  };

  // ------------------------------
  // ⭐ PATIENT COURANT
  // ------------------------------
  const [patient, setPatient] = useState<any>(null);

  useEffect(() => {
    const p =
      localStorage.getItem("patient") ??
      localStorage.getItem("patientSession");

    if (!p) return;

    try {
      const parsed = JSON.parse(p);
      parsed.id = Number(parsed.id);
      setPatient(parsed);
    } catch {
      localStorage.removeItem("patient");
      localStorage.removeItem("patientSession");
    }
  }, []);

  // ------------------------------
  // ⭐ RÉSULTATS À DROITE
  // ------------------------------
  const [filters, setFilters] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!filters) return;
    (async () => {
      const params = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/search-medecins?${params}`);
      const data = await res.json();
      setResults(data.medecins || []);
    })();
  }, [filters]);

  // ------------------------------
  // 🔒 CONTRÔLE ACCÈS MÉDECIN
  // ------------------------------
  async function handleSelectMedecin(m: any) {
    if (!patient) {
      alert("Vous devez être connecté.");
      return;
    }

    if (m.accepteNouveauxPatients) {
      router.push(`/patient/rdv?medecinId=${m.id}`);
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:3001/patient/${patient.id}/can-access-medecin/${m.id}`
      );

      if (!res.ok) {
        alert("Impossible de vérifier l’accès à ce médecin.");
        return;
      }

      const data = await res.json();

      if (!data.allowed) {
        alert(
          "Ce médecin n’accepte pas de nouveaux patients et vous n’êtes pas dans sa base."
        );
        return;
      }

      router.push(`/patient/rdv?medecinId=${m.id}`);
    } catch {
      alert("Erreur réseau lors de la vérification.");
    }
  }

  return (
    <div className="p-5">
      <div className="mb-4">
        <button
          onClick={() => router.push("/patient/dashboard")}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          ← Retour au tableau de bord
        </button>
      </div>

      <div className="flex gap-10">
        <div className="w-1/3">
          <h2 className="text-xl font-bold mb-4">Médecins favoris</h2>

          {loaded ? (
            <FavorisList favoris={favoris} removeFavori={removeFavori} />
          ) : (
            <p>Chargement…</p>
          )}

          <div className="mt-5">
            <AddFavoriInput onAdd={addFavori} />
          </div>
        </div>

        <div className="flex-1">
          <FiltersForm onChangeFilters={setFilters} />

          <div className="mt-5">
            {results.length === 0 ? (
              <p className="text-gray-500">Aucun médecin trouvé.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleSelectMedecin(m)}
                    className="cursor-pointer"
                  >
                    <MedecinCard medecin={m} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
