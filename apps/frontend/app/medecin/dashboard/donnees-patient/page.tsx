"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, CheckCircle, XCircle } from "lucide-react";

export default function DonneesPatientPage() {
  const router = useRouter();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [rowCount, setRowCount] = useState<number>(0); // 🔥 COMPTEUR
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Médecin connecté
  const medecinSession =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("medecinSession") || "{}")
      : {};

  const medecinId = medecinSession?.id;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    setPreview([]);
    setRowCount(0);
    setMessage(null);
    setError(null);

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Le fichier doit être au format CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;

      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length <= 1) {
        setError("Le CSV ne contient aucune donnée patient.");
        return;
      }

      // CSV à virgules (aligné backend)
      const rows = lines.map((line) =>
        line.split(",").map((v) => v.trim())
      );

      setPreview(rows.slice(0, 5));

      // 🔥 nombre de patients = lignes - header
      setRowCount(rows.length - 1);
    };

    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Veuillez sélectionner un fichier CSV.");
      return;
    }

    if (!medecinId) {
      setError("Session médecin introuvable.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/medecin/${medecinId}/import-csv`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Erreur lors de l'import CSV");
      } else {
        setMessage(
          `${rowCount} patient${rowCount > 1 ? "s" : ""} importé${
            rowCount > 1 ? "s" : ""
          } avec succès (ancien fichier remplacé).`
        );
      }
    } catch (err) {
      console.error(err);
      setError("Erreur réseau.");
    }

    setLoading(false);
  };

  return (
    <div className="p-8">
      {/* Retour */}
      <button
        onClick={() => router.push("/medecin/dashboard")}
        className="mb-6 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-3xl font-bold text-slate-200 mb-6">
        Données patients (CSV)
      </h1>

      <div className="bg-slate-800 border border-slate-700 p-6 rounded-lg shadow-md">
        {/* Upload */}
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-emerald-400 transition">
          <div className="flex flex-col items-center">
            <Upload size={32} className="text-slate-400" />
            <p className="text-slate-400 mt-2">
              Importer un fichier CSV
            </p>
          </div>

          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>

        {/* Aperçu */}
        {selectedFile && (
          <div className="mt-6 bg-slate-700 p-4 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-400" />
                <span className="text-slate-200 font-semibold">
                  {selectedFile.name}
                </span>
              </div>

              {/* 🔥 COMPTEUR VISUEL */}
              <span className="text-sm text-slate-300">
                {rowCount} patient{rowCount > 1 ? "s" : ""} détecté
                {rowCount > 1 ? "s" : ""}
              </span>
            </div>

            <table className="w-full text-left text-slate-300 text-sm mt-3 border-collapse">
              <tbody>
                {preview.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-600"
                  >
                    {row.map((col, j) => (
                      <td key={j} className="py-1 px-2">
                        {col || (
                          <span className="text-slate-500">
                            vide
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bouton */}
        <button
          onClick={handleUpload}
          disabled={loading || rowCount === 0}
          className="mt-6 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-md font-semibold disabled:opacity-50"
        >
          {loading ? "Import en cours..." : "Importer maintenant"}
        </button>

        {/* Messages */}
        {message && (
          <div className="mt-4 flex items-center gap-2 text-emerald-400">
            <CheckCircle /> <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400">
            <XCircle /> <span>{error}</span>
          </div>
        )}
      </div>

      {/* Doc */}
      <div className="mt-10 text-slate-400 text-sm">
        <h2 className="text-slate-300 text-lg font-semibold mb-2">
          Format CSV attendu
        </h2>
        <pre className="bg-slate-900 border border-slate-700 p-4 rounded-md whitespace-pre-wrap">
nom,prenom,dateNaissance
DUPONT,JEAN,01/01/1950
        </pre>
        <p className="mt-2">
          ⚠️ Chaque import remplace entièrement le précédent fichier.
        </p>
      </div>
    </div>
  );
}
