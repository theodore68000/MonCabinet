"use client";
import { useState } from "react";

export default function PatientRegister() {
  const [form, setForm] = useState({
    nom: "",
    prenom: "",
    email: "",
    motDePasse: "",
    telephone: "",
  });
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 🔥 CHANGEMENT ICI : on enlève /register
      const res = await fetch("http://localhost:3001/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("Compte créé avec succès ✅");
        setTimeout(() => (window.location.href = "/patient/login"), 1500);
      } else {
        setMessage(data.message || "Erreur lors de l'inscription");
      }
    } catch {
      setMessage("Erreur serveur");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Créer un compte patient</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-64">
        {Object.keys(form).map((key) => (
          <input
            key={key}
            placeholder={key}
            type={key === "motDePasse" ? "password" : "text"}
            className="border p-2 rounded"
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ))}
        <button className="bg-blue-600 text-white p-2 rounded">
          Créer le compte
        </button>
      </form>
      {message && <p className="mt-4 text-red-600">{message}</p>}
    </div>
  );
}
