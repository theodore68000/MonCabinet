"use client";

import { useState } from "react";

export default function MedecinForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false); // ✅ NOUVEL ÉTAT LOCAL

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setSent(false);

    try {
      const res = await fetch("http://localhost:3001/medecin/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Une erreur est survenue");
        return;
      }

      setMessage(data.message); // message backend (optionnel)
      setSent(true); // ✅ déclenche le texte UX
    } catch {
      setError("Erreur serveur. Essayez plus tard.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800">
        <h1 className="text-2xl font-bold text-emerald-400 text-center mb-6">
          Mot de passe oublié (médecin)
        </h1>

        {error && (
          <p className="text-red-400 text-center text-sm mb-3">
            {error}
          </p>
        )}

        {message && (
          <p className="text-emerald-400 text-center text-sm mb-3">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Votre email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-lg bg-slate-800 text-white border border-slate-600"
            required
          />

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg"
          >
            Réinitialiser le mot de passe
          </button>

          {/* ✅ TEXTE DEMANDÉ, SOUS LE BOUTON */}
          {sent && (
            <p className="text-center text-sm text-emerald-300">
              Email de réinitialisation envoyé.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
