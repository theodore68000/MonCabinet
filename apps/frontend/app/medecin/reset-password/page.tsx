"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MedecinResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ✅ TOKEN LU CORRECTEMENT DEPUIS ?token=
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ RÈGLE DE SÉCURITÉ MOT DE PASSE
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Lien invalide ou expiré.");
      return;
    }

    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    // ✅ NOUVELLE VALIDATION
    if (!passwordRegex.test(password)) {
      setError(
        "Le mot de passe doit contenir au moins 12 caractères, avec une majuscule, une minuscule, un chiffre et un caractère spécial."
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `http://localhost:3001/medecin/reset-password/${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            motDePasse: password,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Lien invalide ou expiré.");
        setLoading(false);
        return;
      }

      setMessage("Mot de passe réinitialisé avec succès.");
      setLoading(false);

      setTimeout(() => {
        router.push("/medecin/login");
      }, 1500);
    } catch {
      setError("Erreur serveur, veuillez réessayer.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-slate-900 rounded-xl p-6 shadow-lg border border-slate-800">
        <h1 className="text-2xl font-bold text-emerald-400 text-center mb-6">
          Nouveau mot de passe (médecin)
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
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-bold py-3 rounded-lg"
          >
            {loading ? "Réinitialisation..." : "Réinitialiser"}
          </button>
        </form>
      </div>
    </div>
  );
}
