"use client";

import { useEffect, useState } from "react";

const normalizeText = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function AddFavoriInput({ onAdd }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [allMedecins, setAllMedecins] = useState([]);

  // 🔧 NOUVEAU : charger la liste UNE FOIS
  useEffect(() => {
    fetch(`/api/medecins/search-names`)
      .then((r) => r.json())
      .then((data) => {
        setAllMedecins(data || []);
      })
      .catch(() => {
        setAllMedecins([]);
      });
  }, []);

  const searchMedecins = (value) => {
    setQuery(value);

    if (value.length < 1) {
      setSuggestions([]);
      return;
    }

    const q = normalizeText(value);

    // 🔥 FILTRAGE 100 % FRONT (accents + casse)
    const filtered = allMedecins.filter((m) =>
      normalizeText(`${m.prenom} ${m.nom}`).includes(q)
    );

    setSuggestions(filtered.slice(0, 10)); // limite UX
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => searchMedecins(e.target.value)}
        placeholder="Rechercher un médecin…"
        className="w-full border px-3 py-2 rounded"
      />

      {suggestions.length > 0 && (
        <div className="absolute w-full bg-white shadow max-h-56 overflow-auto z-20 rounded-b">
          {suggestions.map((s) => (
            <div
              key={s.id}
              onClick={() => {
                onAdd(s);
                setQuery("");
                setSuggestions([]);
              }}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b"
            >
              <div className="font-semibold text-base">
                {s.prenom} {s.nom}
              </div>
              <div className="text-sm text-gray-600">
                {s.specialite || "Spécialité non renseignée"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
