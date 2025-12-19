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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/secretaire/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          motDePasse: motDePasse.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Erreur de connexion");
        return;
      }

      localStorage.setItem("secretaireSession", JSON.stringify(data.secretaire));
      router.push("/secretaire/dashboard");
    } catch (err) {
      setError("Erreur serveur");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 w-full max-w-md">
        <h1 className="text-2xl font-bold text-emerald-400 mb-6 text-center">
          Connexion secrétaire
        </h1>

        {error && <p className="text-red-400 text-center mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Mot de passe"
            className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />

          <button
            type="submit"
            className="w-full p-3 bg-emerald-500 rounded-lg font-bold text-black hover:bg-emerald-400"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
