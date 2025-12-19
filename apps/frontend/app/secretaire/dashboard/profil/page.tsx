"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SecretaireProfilPage() {
  const router = useRouter();

  const [secretaire, setSecretaire] = useState<any>(null);
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  /* -----------------------------------------
     LOAD SESSION
  ----------------------------------------- */
  useEffect(() => {
    const saved = localStorage.getItem("secretaireSession");
    if (!saved) {
      router.push("/secretaire/login");
      return;
    }

    const sec = JSON.parse(saved);
    setSecretaire(sec);
    setEmail(sec.email || "");
  }, [router]);

  /* -----------------------------------------
     PASSWORD VALIDATION
  ----------------------------------------- */
  function isPasswordValid(pwd: string) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(
      pwd
    );
  }

  /* -----------------------------------------
     SAVE
  ----------------------------------------- */
  async function handleSave() {
    if (!secretaire) return;

    setError("");
    setMessage("");
    setSaving(true);

    const body: any = {
      email,
    };

    if (password || passwordConfirm) {
      if (!password || !passwordConfirm) {
        setError("Veuillez remplir les deux champs mot de passe.");
        setSaving(false);
        return;
      }

      if (password !== passwordConfirm) {
        setError("Les mots de passe ne correspondent pas.");
        setSaving(false);
        return;
      }

      if (!isPasswordValid(password)) {
        setError(
          "Le mot de passe doit contenir au moins 12 caractères, avec une majuscule, une minuscule, un chiffre et un caractère spécial."
        );
        setSaving(false);
        return;
      }

      body.motDePasse = password;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/secretaire/${secretaire.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message || "Erreur serveur.");
        setSaving(false);
        return;
      }

      // Update session locale
      const updated = { ...secretaire, email };
      localStorage.setItem("secretaireSession", JSON.stringify(updated));
      setSecretaire(updated);

      setPassword("");
      setPasswordConfirm("");
      setMessage("Profil mis à jour avec succès.");
    } catch {
      setError("Erreur serveur.");
    }

    setSaving(false);
  }

  if (!secretaire) return null;

  return (
    <div className="p-8 text-white max-w-xl mx-auto">
      {/* RETOUR */}
      <button
        onClick={() => router.push("/secretaire/dashboard")}
        className="mb-6 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-2xl font-bold text-emerald-400 mb-6">
        Mon profil
      </h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        {/* EMAIL */}
        <div>
          <label className="text-sm text-slate-400">Email</label>
          <input
            type="email"
            className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {/* MOT DE PASSE */}
        <div>
          <label className="text-sm text-slate-400">
            Nouveau mot de passe
          </label>
          <input
            type="password"
            className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Laisser vide pour ne pas changer"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400">
            Confirmer le mot de passe
          </label>
          <input
            type="password"
            className="w-full mt-1 p-3 bg-slate-800 border border-slate-700 rounded-lg"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
        {message && (
          <p className="text-emerald-400 text-sm text-center">
            {message}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-lg mt-4"
        >
          {saving ? "Sauvegarde..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
