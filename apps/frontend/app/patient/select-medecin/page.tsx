'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SelectMedecinPage() {
  const [medecins, setMedecins] = useState<{ id: number; nom: string; prenom: string; specialite?: string }[]>([]);
  const [search, setSearch] = useState('');
  const router = useRouter();

useEffect(() => {
  fetch('http://localhost:3001/medecin')
    .then((res) => res.json())
    .then((data) => {
      // 🧠 Correction : s’assurer que c’est bien un tableau
      if (Array.isArray(data)) {
        setMedecins(data);
      } else if (data && Array.isArray(data.data)) {
        setMedecins(data.data); // cas où l’API renvoie { data: [...] }
      } else {
        console.error('Format inattendu reçu pour les médecins :', data);
        setMedecins([]);
      }
    })
    .catch((err) => {
      console.error('Erreur chargement médecins :', err);
      setMedecins([]);
    });
}, []);


  const filtered = medecins.filter((m) =>
    `${m.nom} ${m.prenom}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: number) => {
    router.push(`/patient/rdv?medecinId=${id}`); // ✅ redirige vers le planning du médecin choisi
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center mb-6">👩‍⚕️ Choisissez votre médecin</h1>

        <input
          type="text"
          placeholder="Rechercher un médecin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border p-3 rounded-lg mb-4"
        />

        <ul className="max-h-72 overflow-y-auto border rounded-lg divide-y">
          {filtered.length > 0 ? (
            filtered.map((m) => (
              <li
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className="p-3 hover:bg-blue-50 cursor-pointer"
              >
                <div className="font-medium">
                  {m.prenom} {m.nom}
                </div>
                {m.specialite && (
                  <div className="text-sm text-gray-500">{m.specialite}</div>
                )}
              </li>
            ))
          ) : (
            <li className="p-3 text-gray-500 text-center">Aucun médecin trouvé</li>
          )}
        </ul>
      </div>
    </main>
  );
}
