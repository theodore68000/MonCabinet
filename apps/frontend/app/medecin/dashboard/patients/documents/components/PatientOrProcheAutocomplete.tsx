"use client";

import { useEffect, useState } from "react";

export type SearchResult =
  | {
      type: "patient";
      patientId: number;
      nom: string;
      prenom: string;
      dateNaissance: string | null;
    }
  | {
      type: "proche";
      procheId: number;
      patientId: number;
      nom: string;
      prenom: string;
      relation: string;
      dateNaissance: string | null;
      patientNom: string;
      patientPrenom: string;
    };

export default function PatientOrProcheAutocomplete({
  medecinId,
  onSelect,
}: {
  medecinId: number;
  onSelect: (r: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const run = async () => {
      setLoading(true);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/medecin/${medecinId}/patients-et-proches?query=${encodeURIComponent(
          query
        )}`
      );
      const data = await res.json();
      setResults(data || []);
      setLoading(false);
    };

    run();
  }, [query, medecinId]);

  return (
    <div className="relative">
      <input
        className="w-full border p-2 rounded"
        placeholder="Rechercher un patient ou un proche"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading && (
        <div className="text-sm text-gray-500 mt-1">Recherche…</div>
      )}

      {results.length > 0 && (
        <div className="absolute z-10 bg-white border rounded w-full mt-1 shadow">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => {
                onSelect(r);
                setQuery(
                  r.type === "patient"
                    ? `${r.prenom} ${r.nom}`
                    : `${r.prenom} ${r.nom} (${r.relation})`
                );
                setResults([]);
              }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            >
              <div className="font-medium">
                {r.prenom} {r.nom}
              </div>

              {r.type === "patient" ? (
                <div className="text-xs text-gray-500">
                  Patient — Né(e) le{" "}
                  {r.dateNaissance ?? "—"}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  Proche ({r.relation}) — Né(e) le{" "}
                  {r.dateNaissance ?? "—"}
                  <br />
                  Patient : {r.patientPrenom} {r.patientNom}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
