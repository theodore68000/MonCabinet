"use client";

import { useEffect, useState } from "react";
import { specialitesList } from "../../../patient/choisir-medecin/components/specialites";

type Medecin = {
  id: number;
  nom: string;
  prenom: string;
  specialite?: string;
};

type Cabinet = {
  id: number;
  nom: string;
  medecins?: Medecin[];
};

export default function AdminMedecinsPage() {
  /* ─────────────── DATA ─────────────── */
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);

  /* ─────────────── AJOUT CABINET ─────────────── */
  const [newCabinetNom, setNewCabinetNom] = useState("");
  const [loadingCabinet, setLoadingCabinet] = useState(false);

  /* ─────────────── AJOUT MEDECIN ─────────────── */
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    motDePasse: "",
    adresseCabinet: "",
    specialite: "",
    cabinetId: "",
    accepteNouveauxPatients: true,
  });

  const [loadingMedecin, setLoadingMedecin] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ─────────────── FETCH CABINETS + MEDECINS ─────────────── */
  const loadCabinets = async () => {
    try {
      const res = await fetch("http://localhost:3001/cabinet");
      const data = await res.json();
      setCabinets(data);
    } catch {
      console.error("Erreur chargement cabinets");
    }
  };

  useEffect(() => {
    loadCabinets();
  }, []);

  /* ─────────────── CREATE CABINET ─────────────── */
  const createCabinet = async () => {
    if (!newCabinetNom.trim()) return;

    setLoadingCabinet(true);
    try {
      const res = await fetch("http://localhost:3001/cabinet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: newCabinetNom }),
      });

      if (!res.ok) throw new Error();

      setNewCabinetNom("");
      await loadCabinets();
    } catch {
      alert("Erreur lors de la création du cabinet");
    } finally {
      setLoadingCabinet(false);
    }
  };

  /* ─────────────── FORM HANDLERS ─────────────── */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.checked });
  };

  /* ─────────────── CREATE MEDECIN ─────────────── */
  const submitMedecin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (
      !form.nom ||
      !form.prenom ||
      !form.email ||
      !form.motDePasse ||
      !form.specialite ||
      !form.cabinetId
    ) {
      setMessage("Tous les champs obligatoires doivent être remplis.");
      return;
    }

    setLoadingMedecin(true);

    try {
      const payload = {
        nom: form.nom,
        prenom: form.prenom,
        email: form.email,
        motDePasse: form.motDePasse,
        adresseCabinet: form.adresseCabinet || undefined,
        specialite: form.specialite,
        cabinetId: Number(form.cabinetId),
        accepteNouveauxPatients: form.accepteNouveauxPatients,
      };

      const res = await fetch("http://localhost:3001/medecin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erreur création médecin");
      }

      setMessage("Médecin créé avec succès.");
      setForm({
        nom: "",
        prenom: "",
        email: "",
        motDePasse: "",
        adresseCabinet: "",
        specialite: "",
        cabinetId: "",
        accepteNouveauxPatients: true,
      });

      await loadCabinets();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoadingMedecin(false);
    }
  };

  /* ─────────────── DELETE MEDECIN ─────────────── */
  const deleteMedecin = async (id: number) => {
    if (!confirm("Supprimer ce médecin ?")) return;

    await fetch(`http://localhost:3001/medecin/${id}`, {
      method: "DELETE",
    });

    await loadCabinets();
  };

  /* ─────────────── DELETE CABINET ─────────────── */
  const deleteCabinet = async (id: number) => {
    if (!confirm("Supprimer ce cabinet ?")) return;

    await fetch(`http://localhost:3001/cabinet/${id}`, {
      method: "DELETE",
    });

    await loadCabinets();
  };

  /* ─────────────── UI ─────────────── */
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-8">
        Administration — Médecins
      </h1>

      <div className="grid grid-cols-3 gap-8">
        {/* ─────────────── GAUCHE (2/3) ─────────────── */}
        <div className="col-span-2 space-y-10">
          {/* AJOUT CABINET */}
          <section className="bg-white p-6 rounded shadow space-y-4">
            <h2 className="text-lg font-semibold">Ajouter un cabinet</h2>
            <div className="flex gap-3">
              <input
                value={newCabinetNom}
                onChange={(e) => setNewCabinetNom(e.target.value)}
                placeholder="Nom du cabinet"
                className="flex-1 border p-2 rounded"
              />
              <button
                onClick={createCabinet}
                disabled={loadingCabinet}
                className="bg-green-600 text-white px-4 rounded disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </section>

          {/* AJOUT MEDECIN */}
          <section className="bg-white p-6 rounded shadow">
            <h2 className="text-lg font-semibold mb-4">
              Ajouter un médecin
            </h2>

            <form onSubmit={submitMedecin} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  name="nom"
                  placeholder="Nom"
                  value={form.nom}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
                <input
                  name="prenom"
                  placeholder="Prénom"
                  value={form.prenom}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
              </div>

              <input
                name="email"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />

              <input
                name="motDePasse"
                type="password"
                placeholder="Mot de passe"
                value={form.motDePasse}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />

              <input
                name="adresseCabinet"
                placeholder="Adresse du cabinet"
                value={form.adresseCabinet}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />

              <select
                name="specialite"
                value={form.specialite}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              >
                <option value="">Choisir une spécialité</option>
                {specialitesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                name="cabinetId"
                value={form.cabinetId}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              >
                <option value="">Choisir un cabinet</option>
                {cabinets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="accepteNouveauxPatients"
                  checked={form.accepteNouveauxPatients}
                  onChange={handleCheckboxChange}
                />
                Accepte les nouveaux patients
              </label>

              {message && (
                <p className="text-sm text-red-600 text-center">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loadingMedecin}
                className="w-full bg-blue-600 text-white py-2 rounded"
              >
                Créer le médecin
              </button>
            </form>
          </section>
        </div>

        {/* ─────────────── DROITE (1/3) ─────────────── */}
        <aside className="bg-white p-6 rounded shadow space-y-6">
          <h2 className="text-lg font-semibold">Cabinets</h2>

          {cabinets.map((cabinet) => (
            <div key={cabinet.id} className="border rounded p-3 space-y-2">
              <div className="flex justify-between items-center">
                <strong>{cabinet.nom}</strong>

                {(!cabinet.medecins || cabinet.medecins.length === 0) && (
                  <button
                    onClick={() => deleteCabinet(cabinet.id)}
                    className="text-red-600"
                    title="Supprimer le cabinet"
                  >
                    🗑️
                  </button>
                )}
              </div>

              <ul className="space-y-1">
                {cabinet.medecins?.map((m) => (
                  <li
                    key={m.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>
                      {m.prenom} {m.nom}
                    </span>
                    <button
                      onClick={() => deleteMedecin(m.id)}
                      className="text-red-600"
                      title="Supprimer le médecin"
                    >
                      🗑️
                    </button>
                  </li>
                ))}

                {(!cabinet.medecins || cabinet.medecins.length === 0) && (
                  <li className="text-xs text-gray-400">
                    Aucun médecin
                  </li>
                )}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );
}
