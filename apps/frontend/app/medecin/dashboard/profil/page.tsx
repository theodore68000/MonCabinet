"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MedecinProfilPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [medecin, setMedecin] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordError, setPasswordError] = useState<string | null>(null);

  /* ------------------------------
     LOAD
  ------------------------------ */
  useEffect(() => {
    const session = localStorage.getItem("medecinSession");

    if (!session) {
      window.location.href = "/medecin/login";
      return;
    }

    const med = JSON.parse(session);
    const medecinId = med.id;

    async function load() {
      const res = await fetch(`http://localhost:3001/medecin/${medecinId}`);
      const data = await res.json();
      setMedecin(data);
      setLoading(false);
    }

    load();
  }, []);

  /* ------------------------------
     PASSWORD VALIDATION
  ------------------------------ */
  function validatePassword(pwd: string) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(
      pwd
    );
  }

  /* ------------------------------
     SAVE
  ------------------------------ */
  async function handleSave() {
    setSaving(true);
    setPasswordError(null);

    const session = JSON.parse(localStorage.getItem("medecinSession")!);
    const medecinId = session.id;

    const payload: any = {
      email: medecin.email,
      telephone: medecin.telephone,
      adresseCabinet: medecin.adresseCabinet,
      bio: medecin.bio,
      horaires: medecin.horaires,
      accepteNouveauxPatients: medecin.accepteNouveauxPatients,
      photoUrl: medecin.photoUrl,
    };

    if (
      passwordForm.oldPassword ||
      passwordForm.newPassword ||
      passwordForm.confirmPassword
    ) {
      if (
        !passwordForm.oldPassword ||
        !passwordForm.newPassword ||
        !passwordForm.confirmPassword
      ) {
        setPasswordError("Tous les champs mot de passe sont requis.");
        setSaving(false);
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordError("Les mots de passe ne correspondent pas.");
        setSaving(false);
        return;
      }

      if (!validatePassword(passwordForm.newPassword)) {
        setPasswordError(
          "12 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial."
        );
        setSaving(false);
        return;
      }

      payload.oldPassword = passwordForm.oldPassword;
      payload.motDePasse = passwordForm.newPassword;
    }

    const res = await fetch(
      `http://localhost:3001/medecin/${medecinId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      alert("Erreur lors de la sauvegarde");
      setSaving(false);
      return;
    }

    alert("Profil mis à jour");
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setSaving(false);
  }

  if (loading) return <p className="text-white p-6">Chargement...</p>;
  if (!medecin)
    return <p className="text-red-400 p-6">Médecin introuvable</p>;

  return (
    <div className="p-8 text-white max-w-5xl mx-auto">
      <button
        onClick={() => router.push("/medecin/dashboard")}
        className="mb-6 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-3xl font-bold mb-8 text-emerald-400">
        Mon profil
      </h1>

      {/* INFOS */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">
          Informations personnelles
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <input disabled value={medecin.nom} className="input-disabled" />
          <input
            disabled
            value={medecin.prenom}
            className="input-disabled"
          />

          <input
            value={medecin.email}
            onChange={(e) =>
              setMedecin({ ...medecin, email: e.target.value })
            }
            className="input"
            placeholder="Email"
          />
        </div>

        {/* CHECKBOX */}
        <div className="mt-6 flex items-center gap-3">
          <input
            type="checkbox"
            checked={!!medecin.accepteNouveauxPatients}
            onChange={(e) =>
              setMedecin({
                ...medecin,
                accepteNouveauxPatients: e.target.checked,
              })
            }
            className="
              w-5 h-5
              border-2 border-white
              bg-slate-900
              rounded
              checked:bg-emerald-500
              checked:border-emerald-500
              accent-emerald-500
              cursor-pointer
            "
          />
          <label className="text-sm cursor-pointer">
            Accepte les nouveaux patients
          </label>
        </div>
      </div>

      {/* CONTACT */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">
          Contact
        </h2>

        <div className="grid grid-cols-2 gap-6">
          <input
            className="input"
            placeholder="Téléphone"
            value={medecin.telephone ?? ""}
            onChange={(e) =>
              setMedecin({ ...medecin, telephone: e.target.value })
            }
          />
          <input
            className="input"
            placeholder="Adresse du cabinet"
            value={medecin.adresseCabinet ?? ""}
            onChange={(e) =>
              setMedecin({
                ...medecin,
                adresseCabinet: e.target.value,
              })
            }
          />
        </div>
      </div>

      {/* PASSWORD */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">
          Changer le mot de passe
        </h2>

        <div className="space-y-4">
          <input
            type="password"
            placeholder="Ancien mot de passe"
            className="input"
            value={passwordForm.oldPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                oldPassword: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="Nouveau mot de passe"
            className="input"
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                newPassword: e.target.value,
              })
            }
          />

          <input
            type="password"
            placeholder="Confirmer le nouveau mot de passe"
            className="input"
            value={passwordForm.confirmPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                confirmPassword: e.target.value,
              })
            }
          />

          {passwordError && (
            <p className="text-red-400 text-sm">{passwordError}</p>
          )}
        </div>
      </div>
 
 {/* TOGGLE NOUVEAUX PATIENTS */}
<div className="mt-6">
  <button
    type="button"
    onClick={() =>
      setMedecin({
        ...medecin,
        accepteNouveauxPatients: !medecin.accepteNouveauxPatients,
      })
    }
    className={`
      flex items-center gap-3
      px-4 py-3
      rounded-lg
      border-2
      transition
      ${
        medecin.accepteNouveauxPatients
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-white/70 bg-transparent"
      }
    `}
  >
    {/* CASE */}
    <div
      className={`
        w-5 h-5
        flex items-center justify-center
        border-2
        rounded
        ${
          medecin.accepteNouveauxPatients
            ? "border-emerald-500 bg-emerald-500"
            : "border-white"
        }
      `}
    >
      {medecin.accepteNouveauxPatients && (
        <span className="text-black text-xs font-bold">✓</span>
      )}
    </div>

    {/* LABEL */}
    <span className="text-sm">
      Accepte les nouveaux patients
    </span>
  </button>
</div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-emerald-500 hover:bg-emerald-600 px-6 py-3 rounded-lg font-semibold"
      >
        {saving ? "Sauvegarde..." : "Enregistrer"}
      </button>
    </div>
  );
}
