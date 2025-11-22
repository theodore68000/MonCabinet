'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Medecin {
  id: number;
  nom: string;
  prenom: string;
  specialite: string;
  accepteNouveauxPatients: boolean;
}

interface Patient {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  medecinTraitantId?: number | null;
}

export default function ChoisirMedecin() {
  const [medecins, setMedecins] = useState<Medecin[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMedecin, setSelectedMedecin] = useState<Medecin | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const router = useRouter();

  // Charger le patient depuis localStorage
  useEffect(() => {
    const local = localStorage.getItem('patient');
    if (local) {
      setPatient(JSON.parse(local));
    }
  }, []);

  // Charger les médecins depuis le backend
  useEffect(() => {
    fetch('http://localhost:3001/medecin')
      .then((res) => res.json())
      .then((data) => setMedecins(data))
      .catch((err) => console.error('Erreur chargement médecins :', err));
  }, []);

  // Filtrer selon la recherche
  const filtered = medecins.filter((m) => {
    const term = search.toLowerCase();
    return (
      m.nom.toLowerCase().includes(term) ||
      m.prenom.toLowerCase().includes(term) ||
      m.specialite.toLowerCase().includes(term)
    );
  });

  // Sélection d’un médecin
  const handleSelect = (m: Medecin) => {
    const estMedecinTraitant = patient?.medecinTraitantId === m.id;
    const disponible = m.accepteNouveauxPatients || estMedecinTraitant;

    if (!disponible) return; // bloqué

    setSelectedMedecin(m);
  };

  // VALIDER
  const handleSubmit = () => {
    if (!selectedMedecin) {
      alert('Veuillez sélectionner un médecin.');
      return;
    }

    router.push(`/patient/rdv?medecinId=${selectedMedecin.id}`);
  };

  return (
    <main className="p-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">🩺 Choisir mon médecin</h1>

      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-md">
        <input
          type="text"
          placeholder="Rechercher un médecin (nom, prénom ou spécialité)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border p-2 rounded mb-4"
        />

        <ul className="max-h-64 overflow-y-auto border rounded-lg">
          {filtered.map((m) => {
            const estMedecinTraitant = patient?.medecinTraitantId === m.id;
            const disponible = m.accepteNouveauxPatients || estMedecinTraitant;

            return (
              <li
                key={m.id}
                onClick={() => disponible && handleSelect(m)}
                className={`
                  p-2 
                  ${disponible ? 'cursor-pointer hover:bg-blue-100' : 'opacity-40 cursor-not-allowed'}
                  ${selectedMedecin?.id === m.id ? 'bg-blue-200 font-semibold' : ''}
                `}
              >
                <div className="flex justify-between items-center">
                  <span>
                    {m.prenom} {m.nom} —{' '}
                    <span className="text-gray-500">{m.specialite}</span>
                  </span>

                  {!disponible && (
                    <span className="text-sm text-red-500">
                      N’accepte plus
                    </span>
                  )}
                </div>
              </li>
            );
          })}

          {filtered.length === 0 && (
            <li className="p-2 text-gray-500 text-center">
              Aucun médecin trouvé
            </li>
          )}
        </ul>

        <button
          onClick={handleSubmit}
          className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
        >
          Continuer ➜
        </button>
      </div>
    </main>
  );
}
