"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientNotesPage() {
  const router = useRouter(); // 🔹 AJOUT

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [note, setNote] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);

  const secretaire =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("secretaireSession") || "null")
      : null;

  // ───────────────────────────────────────────────
  // 🔥 AUTOCOMPLÉTION PATIENTS
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (!secretaire?.id) {
      console.error("❌ Aucun secretaireId trouvé dans localStorage !");
      return;
    }

    const controller = new AbortController();
    const fetchPatients = async () => {
      setLoadingSearch(true);

      const url = `http://localhost:3001/patient/search?query=${encodeURIComponent(
        query
      )}&secretaireId=${secretaire.id}`;

      const res = await fetch(url, { signal: controller.signal });
      const data = await res.json();

      setResults(data || []);
      setLoadingSearch(false);
    };

    fetchPatients();

    return () => controller.abort();
  }, [query]);

  // ───────────────────────────────────────────────
  // 🔥 Sélection patient → on charge la note
  // ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPatient?.id) return;

    const fetchNote = async () => {
      const res = await fetch(
        `http://localhost:3001/patient/${selectedPatient.id}`
      );
      const data = await res.json();

      // Cas où aucune notePatient existe encore
      setNote(data.notePatient || "");
    };

    fetchNote();
  }, [selectedPatient]);

  // ───────────────────────────────────────────────
  // 🔥 SAUVEGARDE NOTE
  // ───────────────────────────────────────────────
  const saveNote = async () => {
    if (!selectedPatient?.id) return;

    const res = await fetch(
      `http://localhost:3001/patient/${selectedPatient.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notePatient: note }),
      }
    );

    if (!res.ok) {
      alert("❌ Impossible d’enregistrer la note.");
      return;
    }

    alert("✔ Note enregistrée !");
  };

  // ───────────────────────────────────────────────
  // 🔥 RENDER
  // ───────────────────────────────────────────────
  return (
    <main className="p-8 max-w-3xl mx-auto">
      {/* 🔙 RETOUR DASHBOARD */}
      <button
        onClick={() => router.push("/secretaire/dashboard")}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-3xl font-bold mb-6">📋 Notes patients</h1>

      {/* AUTOCOMPLETE */}
      <div className="relative mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un patient..."
          className="border p-2 rounded w-full"
        />

        {loadingSearch && (
          <div className="absolute right-3 top-3 text-gray-400 text-sm">
            ⏳
          </div>
        )}

        {results.length > 0 && (
          <div className="absolute bg-white shadow-md w-full rounded z-10 max-h-60 overflow-auto">
            {results.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-3 py-2 hover:bg-gray-100"
                onClick={() => {
                  setSelectedPatient(p);
                  setQuery(`${p.prenom} ${p.nom}`);
                  setResults([]);
                }}
              >
                {p.prenom} {p.nom}
                <div className="text-xs text-gray-500">{p.email}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ZONE DES NOTES */}
      {selectedPatient && (
        <div className="border rounded p-4 bg-gray-50">
          <h2 className="text-xl font-semibold mb-3">
            Patient : {selectedPatient.prenom} {selectedPatient.nom}
          </h2>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notes médicales, infos internes…"
            className="w-full border p-3 rounded min-h-[200px]"
          />

          <button
            onClick={saveNote}
            className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded"
          >
            💾 Enregistrer
          </button>
        </div>
      )}
    </main>
  );
}
