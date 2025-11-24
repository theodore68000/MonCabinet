"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function MedecinResetPassword() {
  const router = useRouter();
  const params = useParams(); 
  const token = params.token as string;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Lien invalide.");
      return;
    }

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:3001/medecin/reset-password/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motDePasse: password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Erreur inconnue.");
        return;
      }

      setMessage("Mot de passe réinitialisé !");
      setTimeout(() => router.push("/medecin/login"), 1500);
    } catch {
      setError("Erreur serveur, réessayez.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800">

        <h1 className="text-2xl font-bold text-emerald-400 text-center mb-6">
          Nouveau mot de passe (médecin)
        </h1>

        {error && <p className="text-red-400 text-center text-sm mb-3">{error}</p>}
        {message && <p className="text-emerald-400 text-center text-sm mb-3">{message}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Nouveau mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-600"
            required
          />

          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-600"
            required
          />

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg"
          >
            Réinitialiser
          </button>
        </form>

      </div>
    </div>
  );
}
