'use client';

import React, { useEffect, useState } from 'react';

interface Medecin {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  specialite?: string;
  adresseCabinet?: string;
  rpps?: string;
  accepteNouveauxPatients?: boolean;
  photoUrl?: string;
  horaires?: any;
  bio?: string;
  typeExercice?: string;
  siret?: string;
  adresseFacturation?: string;
  cabinetId?: number | null;
}

interface Cabinet {
  id: number;
  nom: string;
  adresse?: string | null;
  medecins?: Medecin[];
}

export default function MedecinsPage() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [medecins, setMedecins] = useState<Medecin[]>([]);

  const [cabinetForm, setCabinetForm] = useState({
    nom: '',
    adresse: '',
  });

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    specialite: '',
    adresseCabinet: '',
    rpps: '',
    accepteNouveauxPatients: true,
    photoUrl: '',
    horaires: '',
    bio: '',
    typeExercice: '',
    siret: '',
    adresseFacturation: '',
    cabinetId: '',
  });

  // 🆕 État pour l’édition d’un médecin (modal)
  const [selectedMedecin, setSelectedMedecin] = useState<Medecin | null>(null);
  const [editForm, setEditForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    specialite: '',
    adresseCabinet: '',
    rpps: '',
    accepteNouveauxPatients: true,
    photoUrl: '',
    horaires: '',
    bio: '',
    typeExercice: '',
    siret: '',
    adresseFacturation: '',
    cabinetId: '',
  });

  const loadData = async () => {
    try {
      const [cabRes, medRes] = await Promise.all([
        fetch('http://localhost:3001/cabinet'),
        fetch('http://localhost:3001/medecin'),
      ]);
      const cabData = await cabRes.json();
      const medData = await medRes.json();
      setCabinets(cabData);
      setMedecins(medData);
    } catch (e) {
      console.error('Erreur chargement cabinets / médecins', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const addCabinet = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cabinetForm.nom.trim()) {
      alert('Nom du cabinet obligatoire');
      return;
    }

    const res = await fetch('http://localhost:3001/cabinet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cabinetForm),
    });

    if (!res.ok) {
      alert('Erreur lors de la création du cabinet');
      return;
    }

    setCabinetForm({ nom: '', adresse: '' });
    await loadData();
  };

  const deleteCabinet = async (id: number) => {
    if (!confirm('Supprimer ce cabinet et tous ses médecins ?')) return;

    const res = await fetch(`http://localhost:3001/cabinet/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      alert('Erreur lors de la suppression du cabinet');
      return;
    }

    await loadData();
  };

  const addMedecin = async (e: React.FormEvent) => {
    e.preventDefault();

    let horairesParsed: any = null;

    if (form.horaires.trim() !== '') {
      try {
        horairesParsed = JSON.parse(form.horaires);
      } catch {
        alert('Horaires doit être du JSON valide');
        return;
      }
    }

    const payload: any = {
      ...form,
      horaires: horairesParsed,
    };

    if (form.cabinetId) {
      payload.cabinetId = Number(form.cabinetId);
    } else {
      payload.cabinetId = null;
    }

    const res = await fetch('http://localhost:3001/medecin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert('Erreur lors de la création du médecin');
      return;
    }

    setForm({
      nom: '',
      prenom: '',
      email: '',
      specialite: '',
      adresseCabinet: '',
      rpps: '',
      accepteNouveauxPatients: true,
      photoUrl: '',
      horaires: '',
      bio: '',
      typeExercice: '',
      siret: '',
      adresseFacturation: '',
      cabinetId: '',
    });

    await loadData();
  };

  const deleteMedecin = async (id: number) => {
    if (!confirm('Supprimer ce médecin ?')) return;

    const res = await fetch(`http://localhost:3001/medecin/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      alert('Erreur lors de la suppression du médecin');
      return;
    }

    await loadData();
  };

  // 🆕 Ouvrir le modal d’édition pour un médecin
  const openEditMedecin = (m: Medecin) => {
    setSelectedMedecin(m);
    setEditForm({
      nom: m.nom ?? '',
      prenom: m.prenom ?? '',
      email: m.email ?? '',
      specialite: m.specialite ?? '',
      adresseCabinet: m.adresseCabinet ?? '',
      rpps: m.rpps ?? '',
      accepteNouveauxPatients: m.accepteNouveauxPatients ?? true,
      photoUrl: m.photoUrl ?? '',
      horaires: m.horaires ? JSON.stringify(m.horaires, null, 2) : '',
      bio: m.bio ?? '',
      typeExercice: m.typeExercice ?? '',
      siret: m.siret ?? '',
      adresseFacturation: m.adresseFacturation ?? '',
      cabinetId: m.cabinetId ? String(m.cabinetId) : '',
    });
  };

  // 🆕 Fermer le modal
  const closeEditModal = () => {
    setSelectedMedecin(null);
  };

  // 🆕 Sauvegarder les modifications
  const saveMedecin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedecin) return;

    let horairesParsed: any = null;
    if (editForm.horaires.trim() !== '') {
      try {
        horairesParsed = JSON.parse(editForm.horaires);
      } catch {
        alert('Horaires doit être du JSON valide');
        return;
      }
    }

    const payload: any = {
      nom: editForm.nom,
      prenom: editForm.prenom,
      email: editForm.email,
      specialite: editForm.specialite,
      adresseCabinet: editForm.adresseCabinet,
      rpps: editForm.rpps,
      accepteNouveauxPatients: editForm.accepteNouveauxPatients,
      photoUrl: editForm.photoUrl,
      horaires: horairesParsed,
      bio: editForm.bio,
      typeExercice: editForm.typeExercice,
      siret: editForm.siret,
      adresseFacturation: editForm.adresseFacturation,
    };

    if (editForm.cabinetId) {
      payload.cabinetId = Number(editForm.cabinetId);
    } else {
      payload.cabinetId = null;
    }

    const res = await fetch(
      `http://localhost:3001/medecin/${selectedMedecin.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.message || 'Erreur lors de la mise à jour du médecin');
      return;
    }

    alert('Médecin mis à jour');
    closeEditModal();
    await loadData();
  };

  const medecinsSansCabinet = medecins.filter((m) => !m.cabinetId);

  return (
    <main className="p-8 space-y-8">
      <h1 className="text-2xl font-bold mb-4">
        🗂️ Cabinets & 👨‍⚕️ Médecins
      </h1>

      {/* FORMULAIRES */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cabinet form */}
        <div className="bg-white p-4 rounded-lg shadow border">
          <h2 className="font-semibold mb-3">📁 Ajouter un cabinet</h2>
          <form onSubmit={addCabinet} className="space-y-2">
            <input
              placeholder="Nom du cabinet"
              value={cabinetForm.nom}
              onChange={(e) =>
                setCabinetForm({ ...cabinetForm, nom: e.target.value })
              }
              className="border p-2 rounded w-full"
              required
            />
            <input
              placeholder="Adresse (optionnel)"
              value={cabinetForm.adresse}
              onChange={(e) =>
                setCabinetForm({ ...cabinetForm, adresse: e.target.value })
              }
              className="border p-2 rounded w-full"
            />
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Ajouter Cabinet
            </button>
          </form>
        </div>

        {/* Médecin form */}
        <div className="bg-white p-4 rounded-lg shadow border">
          <h2 className="font-semibold mb-3">👨‍⚕️ Ajouter un médecin</h2>
          <form onSubmit={addMedecin} className="grid grid-cols-2 gap-2">
            <input
              placeholder="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              className="border p-2 rounded col-span-1"
              required
            />
            <input
              placeholder="Prénom"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              className="border p-2 rounded col-span-1"
              required
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="border p-2 rounded col-span-2"
              required
            />
            <input
              placeholder="Spécialité"
              value={form.specialite}
              onChange={(e) =>
                setForm({ ...form, specialite: e.target.value })
              }
              className="border p-2 rounded col-span-1"
            />
            <input
              placeholder="Adresse cabinet"
              value={form.adresseCabinet}
              onChange={(e) =>
                setForm({ ...form, adresseCabinet: e.target.value })
              }
              className="border p-2 rounded col-span-1"
            />
            <input
              placeholder="RPPS"
              value={form.rpps}
              onChange={(e) => setForm({ ...form, rpps: e.target.value })}
              className="border p-2 rounded col-span-1"
            />
            <input
              placeholder="Type d'exercice"
              value={form.typeExercice}
              onChange={(e) =>
                setForm({ ...form, typeExercice: e.target.value })
              }
              className="border p-2 rounded col-span-1"
            />
            <input
              placeholder="SIRET"
              value={form.siret}
              onChange={(e) => setForm({ ...form, siret: e.target.value })}
              className="border p-2 rounded col-span-1"
            />
            <input
              placeholder="Adresse de facturation"
              value={form.adresseFacturation}
              onChange={(e) =>
                setForm({
                  ...form,
                  adresseFacturation: e.target.value,
                })
              }
              className="border p-2 rounded col-span-1"
            />
            <textarea
              placeholder="Bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="border p-2 rounded col-span-2"
            />
            <textarea
              placeholder='Horaires (JSON ex: {"lundi":["08:00-12:00"]})'
              value={form.horaires}
              onChange={(e) =>
                setForm({ ...form, horaires: e.target.value })
              }
              className="border p-2 rounded col-span-2"
            />
            <label className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                checked={form.accepteNouveauxPatients}
                onChange={(e) =>
                  setForm({
                    ...form,
                    accepteNouveauxPatients: e.target.checked,
                  })
                }
              />
              Accepte les nouveaux patients
            </label>

            {/* Sélection du cabinet */}
            <select
              value={form.cabinetId}
              onChange={(e) =>
                setForm({ ...form, cabinetId: e.target.value })
              }
              className="border p-2 rounded col-span-2"
            >
              <option value="">Sans cabinet</option>
              {cabinets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>

            <button className="bg-green-600 text-white px-4 py-2 rounded col-span-2">
              Ajouter Médecin
            </button>
          </form>
        </div>
      </section>

      {/* LISTE DES CABINETS AVEC MÉDECINS (dossiers) */}
      <section className="space-y-4">
        <h2 className="font-semibold text-lg">📁 Cabinets</h2>

        {cabinets.length === 0 && (
          <p className="text-gray-500">Aucun cabinet pour l’instant.</p>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {cabinets.map((cab) => (
            <div
              key={cab.id}
              className="bg-white border rounded-lg shadow-sm p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500">📁</span>
                    <h3 className="font-semibold text-lg">{cab.nom}</h3>
                  </div>
                  {cab.adresse && (
                    <p className="text-sm text-gray-500">{cab.adresse}</p>
                  )}
                </div>

                <button
                  onClick={() => deleteCabinet(cab.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Supprimer le cabinet et ses médecins"
                >
                  🗑
                </button>
              </div>

              <div className="mt-3">
                {cab.medecins && cab.medecins.length > 0 ? (
                  <table className="w-full text-sm border-t">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left text-xs uppercase tracking-wide">
                          Nom
                        </th>
                        <th className="p-2 text-left text-xs uppercase tracking-wide">
                          Spécialité
                        </th>
                        <th className="p-2 text-left text-xs uppercase tracking-wide">
                          Nouveaux
                        </th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cab.medecins.map((m) => (
                        <tr
                          key={m.id}
                          className="border-t cursor-pointer hover:bg-gray-50 text-sm"
                          onClick={() => openEditMedecin(m)}
                        >
                          <td className="p-3 font-medium">
                            {m.prenom} {m.nom}
                          </td>
                          <td className="p-3">{m.specialite}</td>
                          <td className="p-3">
                            {m.accepteNouveauxPatients ? '🟢' : '🔴'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteMedecin(m.id);
                              }}
                              className="text-red-500 hover:text-red-700"
                              title="Supprimer le médecin"
                            >
                              🗑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-500">
                    Aucun médecin dans ce cabinet.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MÉDECINS SANS CABINET */}
      <section className="space-y-2">
        <h2 className="font-semibold text-lg">👨‍⚕️ Médecins sans cabinet</h2>
        {medecinsSansCabinet.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucun médecin sans cabinet.</p>
        ) : (
          <table className="w-full border-collapse bg-white rounded-lg shadow overflow-hidden">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left text-xs uppercase tracking-wide">
                  Nom
                </th>
                <th className="p-2 text-left text-xs uppercase tracking-wide">
                  Email
                </th>
                <th className="p-2 text-left text-xs uppercase tracking-wide">
                  Spécialité
                </th>
                <th className="p-2 text-left text-xs uppercase tracking-wide">
                  Nouveaux Patients
                </th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {medecinsSansCabinet.map((m) => (
                <tr
                  key={m.id}
                  className="border-t cursor-pointer hover:bg-gray-50 text-sm"
                  onClick={() => openEditMedecin(m)}
                >
                  <td className="p-3 font-medium">
                    {m.prenom} {m.nom}
                  </td>
                  <td className="p-3">{m.email}</td>
                  <td className="p-3">{m.specialite}</td>
                  <td className="p-3">
                    {m.accepteNouveauxPatients ? '🟢' : '🔴'}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMedecin(m.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                      title="Supprimer le médecin"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 🆕 MODAL ÉDITION MÉDECIN */}
      {selectedMedecin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              Modifier le médecin
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {selectedMedecin.prenom} {selectedMedecin.nom} ({selectedMedecin.email})
            </p>

            <form onSubmit={saveMedecin} className="grid grid-cols-2 gap-3">
              <input
                className="border p-2 rounded col-span-1"
                placeholder="Nom"
                value={editForm.nom}
                onChange={(e) =>
                  setEditForm({ ...editForm, nom: e.target.value })
                }
                required
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="Prénom"
                value={editForm.prenom}
                onChange={(e) =>
                  setEditForm({ ...editForm, prenom: e.target.value })
                }
                required
              />
              <input
                className="border p-2 rounded col-span-2"
                placeholder="Email"
                value={editForm.email}
                onChange={(e) =>
                  setEditForm({ ...editForm, email: e.target.value })
                }
                required
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="Spécialité"
                value={editForm.specialite}
                onChange={(e) =>
                  setEditForm({ ...editForm, specialite: e.target.value })
                }
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="Adresse cabinet"
                value={editForm.adresseCabinet}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    adresseCabinet: e.target.value,
                  })
                }
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="RPPS"
                value={editForm.rpps}
                onChange={(e) =>
                  setEditForm({ ...editForm, rpps: e.target.value })
                }
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="Type d'exercice"
                value={editForm.typeExercice}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    typeExercice: e.target.value,
                  })
                }
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="SIRET"
                value={editForm.siret}
                onChange={(e) =>
                  setEditForm({ ...editForm, siret: e.target.value })
                }
              />
              <input
                className="border p-2 rounded col-span-1"
                placeholder="Adresse de facturation"
                value={editForm.adresseFacturation}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    adresseFacturation: e.target.value,
                  })
                }
              />
              <textarea
                className="border p-2 rounded col-span-2"
                placeholder="Bio"
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm({ ...editForm, bio: e.target.value })
                }
              />
              <textarea
                className="border p-2 rounded col-span-2 font-mono text-xs"
                rows={6}
                placeholder='Horaires (JSON ex: {"lundi":["08:00-12:00"]})'
                value={editForm.horaires}
                onChange={(e) =>
                  setEditForm({ ...editForm, horaires: e.target.value })
                }
              />

              <label className="flex items-center gap-2 col-span-2 mt-1">
                <input
                  type="checkbox"
                  checked={editForm.accepteNouveauxPatients}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      accepteNouveauxPatients: e.target.checked,
                    })
                  }
                />
                Accepte les nouveaux patients
              </label>

              <select
                className="border p-2 rounded col-span-2"
                value={editForm.cabinetId}
                onChange={(e) =>
                  setEditForm({ ...editForm, cabinetId: e.target.value })
                }
              >
                <option value="">Sans cabinet</option>
                {cabinets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nom}
                  </option>
                ))}
              </select>

              <div className="col-span-2 flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 rounded border"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-blue-600 text-white"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
