"use client";

import { useState, useEffect } from "react";
import { specialitesList } from "./specialites";

export default function FiltersForm({ onChangeFilters }) {
  const [filters, setFilters] = useState({
    specialites: [],
    rayon: "any",
    avis: "any",
    delai: "any",
  });

  const update = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };

  // 🔥 dès qu’un filtre change → on push vers le parent
  useEffect(() => {
    onChangeFilters(filters);
  }, [filters]);

  return (
    <div className="border p-4 rounded-lg shadow-sm bg-white">
      <h2 className="font-semibold text-lg mb-3">Filtres</h2>

      {/* SPÉCIALITÉ */}
      <label className="block text-sm font-medium mb-1">Spécialité</label>
      <select
        className="border p-2 rounded w-full"
        onChange={(e) => update("specialites", [e.target.value])}
      >
        <option value="">Toutes</option>
        {specialitesList.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* RAYON */}
      <label className="block text-sm mt-4 font-medium mb-1">Rayon</label>
      <select
        className="border p-2 rounded w-full"
        onChange={(e) => update("rayon", e.target.value)}
      >
        <option value="any">Peu importe</option>
        <option value="2">2 km</option>
        <option value="5">5 km</option>
        <option value="10">10 km</option>
        <option value="20">20 km</option>
        <option value="50">50 km</option>
        <option value="9999">Sans limite</option>
      </select>

      {/* AVIS */}
      <label className="block text-sm mt-4 font-medium mb-1">Avis minimum</label>
      <select
        className="border p-2 rounded w-full"
        onChange={(e) => update("avis", e.target.value)}
      >
        <option value="any">Peu importe</option>
        <option value="4">4.0+</option>
        <option value="4.2">4.2+</option>
        <option value="4.4">4.4+</option>
        <option value="4.6">4.6+</option>
        <option value="4.8">4.8+</option>
      </select>

      {/* DÉLAI */}
      <label className="block text-sm mt-4 font-medium mb-1">Premiers RDV</label>
      <select
        className="border p-2 rounded w-full"
        onChange={(e) => update("delai", e.target.value)}
      >
        <option value="any">Peu importe</option>
        <option value="2">Aujourd'hui ou demain</option>
        <option value="3">Sous 3 jours</option>
        <option value="7">Sous 1 semaine</option>
        <option value="14">Sous 2 semaines</option>
        <option value="30">Sous 1 mois</option>
      </select>
    </div>
  );
}
