"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { Plus, Trash, RefreshCcw } from "lucide-react";

type MedecinSession = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
};

type Secretaire = {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export default function SecretairesPage() {
  const router = useRouter();

  const [medecin, setMedecin] = useState<MedecinSession | null>(null);
  const [secretaires, setSecretaires] = useState<Secretaire[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [selectedSecretaire, setSelectedSecretaire] =
    useState<Secretaire | null>(null);

  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);

  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    telephone: "",
  });

  /* ------------------------------
     SESSION MEDECIN
  ------------------------------ */
  useEffect(() => {
    const saved = localStorage.getItem("medecinSession");
    if (!saved) return;

    try {
      setMedecin(JSON.parse(saved));
    } catch {
      localStorage.removeItem("medecinSession");
    }
  }, []);

  /* ------------------------------
      FETCH SECRÉTAIRES
  ------------------------------ */
  const fetchSecretaires = async () => {
    if (!medecin) return;

    setLoading(true);
    const res = await fetch(
      `http://localhost:3001/medecin/${medecin.id}/secretaires`
    );
    const data = await res.json();
    setSecretaires(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSecretaires();
  }, [medecin]);

  /* ------------------------------
      CRÉATION
  ------------------------------ */
  const createSecretaire = async () => {
    if (!medecin) return;

    const res = await fetch(
      `http://localhost:3001/medecin/${medecin.id}/secretaires`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );

    const data = await res.json();

    if (data.success) {
      setCreatedPassword(data.motDePasseProvisoire);
      setModalOpen(false);
      setForm({ nom: "", prenom: "", email: "", telephone: "" });
      fetchSecretaires();
    } else {
      alert(data.message || "Erreur");
    }
  };

  /* ------------------------------
      SUPPRESSION
  ------------------------------ */
  const deleteSecretaire = async (secretaireId: number) => {
    if (!medecin) return;

    await fetch(
      `http://localhost:3001/medecin/${medecin.id}/secretaires/${secretaireId}`,
      { method: "DELETE" }
    );

    fetchSecretaires();
  };

  /* ------------------------------
      DÉTAILS
  ------------------------------ */
  const openDetails = async (id: number) => {
    if (!medecin) return;

    const res = await fetch(
      `http://localhost:3001/medecin/${medecin.id}/secretaires/${id}`
    );
    const data = await res.json();

    setSelectedSecretaire(data);
    setResetPassword(null);
    setDetailsOpen(true);
  };

  const regeneratePassword = async () => {
    if (!medecin || !selectedSecretaire) return;

    const res = await fetch(
      `http://localhost:3001/medecin/${medecin.id}/secretaires/${selectedSecretaire.id}/reset-password`,
      { method: "POST" }
    );

    const data = await res.json();
    setResetPassword(data.motDePasseProvisoire);
  };

  /* ------------------------------
      RENDER
  ------------------------------ */
  return (
    <div className="flex bg-slate-950 text-white min-h-screen">
      <Sidebar />

      <div className="flex-1 p-8 max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/medecin/dashboard")}
          className="mb-6 px-4 py-2 bg-slate-800 rounded hover:bg-slate-700"
        >
          ← Retour au dashboard
        </button>

        <h1 className="text-2xl font-bold text-emerald-400 mb-6">
          Gestion des secrétaires
        </h1>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded-xl mb-6"
        >
          <Plus size={18} /> Ajouter une secrétaire
        </button>

        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : secretaires.length === 0 ? (
          <p className="text-slate-500">Aucune secrétaire.</p>
        ) : (
          <div className="space-y-3">
            {secretaires.map((s) => (
              <div
                key={s.id}
                onClick={() => openDetails(s.id)}
                className="cursor-pointer bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center hover:bg-slate-800/60"
              >
                <div>
                  <p className="font-semibold text-lg">
                    {s.prenom} {s.nom}
                  </p>
                  <p className="text-slate-400 text-sm">{s.email}</p>
                  {s.telephone && (
                    <p className="text-slate-500 text-sm">{s.telephone}</p>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSecretaire(s.id);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash size={20} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* MODAL CRÉATION */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Créer une secrétaire</h2>

              <div className="space-y-3">
                {["prenom", "nom", "email", "telephone"].map((k) => (
                  <input
                    key={k}
                    placeholder={k}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                    value={(form as any)[k]}
                    onChange={(e) =>
                      setForm({ ...form, [k]: e.target.value })
                    }
                  />
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1 bg-slate-800 rounded"
                >
                  Annuler
                </button>
                <button
                  onClick={createSecretaire}
                  className="px-4 py-2 bg-emerald-500 text-black rounded font-semibold"
                >
                  Créer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DÉTAILS */}
        {detailsOpen && selectedSecretaire && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Détails secrétaire</h2>

              <div className="space-y-2 text-sm">
                <div>Nom : {selectedSecretaire.nom}</div>
                <div>Prénom : {selectedSecretaire.prenom}</div>
                <div>Email : {selectedSecretaire.email}</div>
                <div>
                  Téléphone : {selectedSecretaire.telephone || "—"}
                </div>
              </div>

              <button
                onClick={regeneratePassword}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-500 text-black py-2 rounded font-semibold"
              >
                <RefreshCcw size={16} />
                Régénérer mot de passe provisoire
              </button>

              {resetPassword && (
                <div className="mt-4 bg-emerald-600/20 border border-emerald-500/50 rounded p-3 text-center">
                  <p className="text-emerald-300 font-bold">
                    {resetPassword}
                  </p>
                </div>
              )}

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => {
                    setDetailsOpen(false);
                    setResetPassword(null);
                  }}
                  className="px-3 py-1 bg-slate-800 rounded"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MDP PROVISOIRE CRÉATION */}
        {createdPassword && (
          <div className="mt-6 bg-emerald-600/20 border border-emerald-500/50 rounded-xl p-4 text-center">
            <p className="text-emerald-300">
              Mot de passe provisoire :
              <span className="font-bold block mt-1">
                {createdPassword}
              </span>
            </p>
            <button
              onClick={() => setCreatedPassword(null)}
              className="mt-3 px-3 py-1 bg-slate-800 rounded"
            >
              Ok
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
