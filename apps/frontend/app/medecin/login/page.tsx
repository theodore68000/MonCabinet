"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MedecinAuthLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:3001/medecin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          motDePasse: password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      // ⬅️ Correction : forcer string
      localStorage.setItem(
  "medecinSession",
  JSON.stringify({
    id: data.medecin.id,
    nom: data.medecin.nom,
    prenom: data.medecin.prenom,
    email: data.medecin.email,
    telephone: data.medecin.telephone,
    specialite: data.medecin.specialite,
    adresseCabinet: data.medecin.adresseCabinet,
    rpps: data.medecin.rpps,
    siret: data.medecin.siret,
  })
);


      router.push("/medecin/dashboard");
    } catch (err) {
      setError("Erreur serveur, réessayez plus tard.");
    }
  };

return (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
    <div className="w-full max-w-md bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800">

      <h1 className="text-2xl font-bold text-emerald-400 text-center mb-6">
        Connexion médecin
      </h1>

      {error && (
        <p className="text-red-400 text-center text-sm mb-3">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-600"
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-600"
          required
        />

        <button
          type="submit"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg"
        >
          Se connecter
        </button>
      </form>

      {/* 🔥 Lien mot de passe oublié */}
      <div className="text-center mt-4">
        <a
          href="/medecin/forgot-password"
          className="text-emerald-400 text-sm hover:text-emerald-300 transition"
        >
          Mot de passe oublié ?
        </a>
      </div>

    </div>
  </div>
);
}
