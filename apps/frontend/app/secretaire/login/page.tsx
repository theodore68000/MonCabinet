"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SecretaireLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/secretaire/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            motDePasse,
          }),
        }
      );

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Erreur de connexion");
        return;
      }

      localStorage.setItem(
        "secretaireSession",
        JSON.stringify(data.secretaire)
      );

      router.push("/secretaire/dashboard");
    } catch {
      setError("Erreur serveur");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md border border-slate-800">
        <h1 className="text-2xl font-bold text-emerald-400 mb-4 text-center">
          Connexion secrétaire
        </h1>

        {error && (
          <p className="text-red-400 text-sm text-center mb-3">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            className="w-full p-3 bg-slate-800 rounded-lg border border-slate-600 text-white"
            placeholder="Email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />

<input
  type="password"
  className="w-full p-3 bg-slate-800 rounded-lg border border-slate-600 text-white"
  placeholder="Mot de passe"
  required
  value={motDePasse}
  onChange={(e) => setMotDePasse(e.target.value)}
/>

          <button
            type="submit"
            className="w-full p-3 bg-emerald-500 rounded-lg font-bold text-black hover:bg-emerald-400 transition"
          >
            Se connecter
          </button>
        </form>

        {/* --------------------------- */}
        {/*  Liens supplémentaires     */}
        {/* --------------------------- */}
        <div className="mt-4 text-center space-y-2">
          <div>
            <button
              className="text-slate-400 hover:text-slate-300 text-sm"
              onClick={() => router.push("/medecin/login")}
            >
              Je suis médecin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
