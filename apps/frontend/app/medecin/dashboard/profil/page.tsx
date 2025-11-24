"use client";

import { useEffect, useState } from "react";

export default function MedecinProfilPage() {
  const [loading, setLoading] = useState(true);
  const [medecin, setMedecin] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("medecinSession");

    if (!session) {
      window.location.href = "/medecin/login";
      return;
    }

    const med = JSON.parse(session);
    const medecinId = med.id;

    async function load() {
      try {
        const BACKEND_URL = "http://localhost:3001";
        const res = await fetch(`${BACKEND_URL}/medecin/${medecinId}`);

        if (!res.ok) {
          console.error("Erreur API :", res.status);
          setLoading(false);
          return;
        }

        const data = await res.json();
        setMedecin(data);
      } catch (e) {
        console.error("Erreur fetch :", e);
      }

      setLoading(false);
    }

    load();
  }, []);

async function handleSave() {
  setSaving(true);

  const session = JSON.parse(localStorage.getItem("medecinSession")!);
  const medecinId = session.id;

  const BACKEND_URL = "http://localhost:3001";

  // ⚠️ On n'envoie que les champs modifiables
  const safeData = {
    email: medecin.email,
    motDePasse: medecin.motDePasse ? medecin.motDePasse : undefined,
    telephone: medecin.telephone,
    specialite: medecin.specialite,
    adresseCabinet: medecin.adresseCabinet,
    bio: medecin.bio,
    horaires: medecin.horaires,
    accepteNouveauxPatients: medecin.accepteNouveauxPatients,
    photoUrl: medecin.photoUrl,
    typeExercice: medecin.typeExercice,
    siret: medecin.siret,
    adresseFacturation: medecin.adresseFacturation,
  };

  // 🔍 Log pour vérifier ce qui part réellement dans la requête
  console.log("🔎 Envoi PATCH :", safeData);

  const res = await fetch(`${BACKEND_URL}/medecin/${medecinId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safeData),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error("❌ ERREUR BACKEND :", res.status, txt);
    alert("Erreur lors de la sauvegarde");
    setSaving(false);
    return;
  }

  alert("Profil mis à jour !");
  setSaving(false);
}


  if (loading) return <p className="text-white p-6">Chargement...</p>;
  if (!medecin) return <p className="text-red-400 p-6">Erreur : Médecin introuvable.</p>;

  return (
    <div className="p-8 text-white">

      <h1 className="text-3xl font-bold mb-8 text-emerald-400">
        Mon profil
      </h1>

      {/* --- Section Infos personnelles --- */}
      <div className="bg-slate-800 p-6 rounded-xl shadow mb-8 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">Informations personnelles</h2>

        <div className="grid grid-cols-2 gap-6 mt-4">
          <div>
            <label className="text-sm text-slate-400">Nom (non modifiable)</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-slate-500"
              value={medecin.nom}
              disabled
            />
          </div>

          <div>
            <label className="text-sm text-slate-400">Prénom (non modifiable)</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded text-slate-500"
              value={medecin.prenom}
              disabled
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Email</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              value={medecin.email}
              onChange={(e) => setMedecin({ ...medecin, email: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Mot de passe</label>
            <input
              type="password"
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              placeholder="Nouveau mot de passe"
              onChange={(e) => setMedecin({ ...medecin, motDePasse: e.target.value })}
            />
          </div>

<div className="flex items-center gap-3 mt-4">
  <input
    type="checkbox"
    checked={medecin.accepteNouveauxPatients}
    onChange={(e) =>
      setMedecin({ ...medecin, accepteNouveauxPatients: e.target.checked })
    }
    className="w-5 h-5 accent-emerald-500"
  />
  <label className="text-sm text-slate-300">
    Accepte les nouveaux patients
  </label>
</div>

        </div>
      </div>

      {/* --- Section Contact --- */}
      <div className="bg-slate-800 p-6 rounded-xl shadow mb-8 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">Contact</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-slate-300">Téléphone</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              value={medecin.telephone ?? ""}
              onChange={(e) => setMedecin({ ...medecin, telephone: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Adresse du cabinet</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              value={medecin.adresseCabinet ?? ""}
              onChange={(e) => setMedecin({ ...medecin, adresseCabinet: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* --- Section Exercice --- */}
      <div className="bg-slate-800 p-6 rounded-xl shadow mb-8 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-emerald-300">Exercice médical</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-slate-300">Type d’exercice</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              value={medecin.typeExercice ?? ""}
              onChange={(e) => setMedecin({ ...medecin, typeExercice: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">SIRET</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              value={medecin.siret ?? ""}
              onChange={(e) => setMedecin({ ...medecin, siret: e.target.value })}
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm text-slate-300">Adresse de facturation</label>
            <input
              className="w-full bg-slate-900 border border-slate-700 p-3 rounded"
              value={medecin.adresseFacturation ?? ""}
              onChange={(e) => setMedecin({ ...medecin, adresseFacturation: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* --- Bouton sauvegarde --- */}
      <button
        onClick={handleSave}
        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-3 rounded-lg shadow-lg transition"
        disabled={saving}
      >
        {saving ? "Sauvegarde..." : "Enregistrer"}
      </button>
    </div>
  );
}
