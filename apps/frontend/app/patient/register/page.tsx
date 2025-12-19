"use client";

import { useState } from "react";

type FormState = {
  nom: string;
  prenom: string;
  email: string;
  dateNaissance: string;
  telephone: string;
  adresse: string;
  codePostal: string;
  ville: string;
  motDePasse: string;
  confirmMotDePasse: string;
};

export default function PatientRegister() {
  const [form, setForm] = useState<FormState>({
    nom: "",
    prenom: "",
    email: "",
    dateNaissance: "",
    telephone: "",
    adresse: "",
    codePostal: "",
    ville: "",
    motDePasse: "",
    confirmMotDePasse: "",
  });

  const [message, setMessage] = useState<string>("");

  /* -------------------------------------------------------------
   * HELPERS FORMAT
   ------------------------------------------------------------- */

  const formatNom = (value: string) => value.toUpperCase();

  const formatPrenom = (value: string) => {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  };

  const formatDate = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  };

  const formatTelephone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  };

  /* -------------------------------------------------------------
   * VALIDATIONS
   ------------------------------------------------------------- */

  const isEmailValid = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isPasswordStrong = (pwd: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/.test(pwd);

  /* -------------------------------------------------------------
   * SUBMIT
   ------------------------------------------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!isEmailValid(form.email)) {
      setMessage("Email invalide");
      return;
    }

    if (!isPasswordStrong(form.motDePasse)) {
      setMessage(
        "Mot de passe trop faible : plus de 10 caractères avec minimum : une majuscule, une minuscule, un chiffre et un caractère spécial)",
      );
      return;
    }

    if (form.motDePasse !== form.confirmMotDePasse) {
      setMessage("Les mots de passe ne correspondent pas");
      return;
    }

    try {
      const res = await fetch("http://localhost:3001/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom,
          prenom: form.prenom,
          email: form.email,
          telephone: form.telephone,
          adresse: `${form.adresse}, ${form.codePostal} ${form.ville}`,

          // ✅ NOUVEAU CONTRAT (OBLIGATOIRE)
          dateNaissance: form.dateNaissance,

          // ✅ LEGACY CONSERVÉ (COMME DEMANDÉ)
          anneeNaissance: Number(form.dateNaissance.slice(6)),

          motDePasse: form.motDePasse,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.success === false) {
        setMessage(data.message || "Erreur lors de l'inscription");
        return;
      }

      window.location.href = `/patient/verify-email?email=${form.email}`;
    } catch {
      setMessage("Erreur serveur");
    }
  };

  /* -------------------------------------------------------------
   * RENDER
   ------------------------------------------------------------- */

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow-md w-full max-w-md flex flex-col gap-3"
      >
        <h1 className="text-xl font-bold text-center">
          Créer un compte patient
        </h1>

        <input
          placeholder="NOM"
          className="border p-2 rounded"
          value={form.nom}
          onChange={(e) =>
            setForm({ ...form, nom: formatNom(e.target.value) })
          }
          required
        />

        <input
          placeholder="Prénom"
          className="border p-2 rounded"
          value={form.prenom}
          onChange={(e) =>
            setForm({ ...form, prenom: formatPrenom(e.target.value) })
          }
          required
        />

        <input
          placeholder="email@example.com"
          className="border p-2 rounded"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />

        <input
          placeholder="Date de naissance (dd/mm/yyyy)"
          className="border p-2 rounded"
          value={form.dateNaissance}
          onChange={(e) =>
            setForm({ ...form, dateNaissance: formatDate(e.target.value) })
          }
          required
        />

        <input
          placeholder="Téléphone (01 02 03 04 05)"
          className="border p-2 rounded"
          value={form.telephone}
          onChange={(e) =>
            setForm({ ...form, telephone: formatTelephone(e.target.value) })
          }
          required
        />

        <input
          placeholder="Adresse (numéro et rue)"
          className="border p-2 rounded"
          value={form.adresse}
          onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          required
        />

        <div className="flex gap-2">
          <input
            placeholder="Code postal"
            className="border p-2 rounded w-1/3"
            value={form.codePostal}
            onChange={(e) =>
              setForm({
                ...form,
                codePostal: e.target.value.replace(/\D/g, "").slice(0, 5),
              })
            }
            required
          />
          <input
            placeholder="Ville"
            className="border p-2 rounded w-2/3"
            value={form.ville}
            onChange={(e) => setForm({ ...form, ville: e.target.value })}
            required
          />
        </div>

        <input
          type="password"
          placeholder="Mot de passe"
          className="border p-2 rounded"
          value={form.motDePasse}
          onChange={(e) => setForm({ ...form, motDePasse: e.target.value })}
          required
        />

        <input
          type="password"
          placeholder="Confirmation mot de passe"
          className="border p-2 rounded"
          value={form.confirmMotDePasse}
          onChange={(e) =>
            setForm({ ...form, confirmMotDePasse: e.target.value })
          }
          required
        />

        <button className="bg-blue-600 text-white p-2 rounded mt-2">
          Créer le compte
        </button>

        {message && (
          <p className="text-red-600 text-sm text-center">{message}</p>
        )}
      </form>
    </div>
  );
}
