"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PatientLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await fetch("http://localhost:3001/patient/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, motDePasse }),
      });

      const data = await res.json();

      if (!res.ok || data.message) {
        setMessage(data.message || "Erreur de connexion");
        return;
      }

      // 🔥 Connexion OK
      setMessage("Connexion réussie ✅");

      // ⬇⬇⬇ AUCUN CODE ENLEVÉ — JUSTE AJOUTÉ ⬇⬇⬇

      // Sauvegarde locale
      if (typeof window !== "undefined") {
        localStorage.setItem("patientSession", JSON.stringify(data));
      }

      // ✅ AJOUT : on met l’ID dans un cookie accessible au front
      // (Ton backend renvoie déjà "id", donc on l’utilise tel quel)
      document.cookie = `id=${data.id}; path=/; SameSite=Lax`;

      // Redirection
      router.push("/patient/dashboard");
    } catch (error) {
      console.error("Erreur serveur :", error);
      setMessage("Erreur serveur");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Connexion Patient</h1>

      <form onSubmit={handleLogin} className="flex flex-col gap-2 w-64">
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          className="border p-2 rounded"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          required
        />

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
        >
          Se connecter
        </button>
      </form>

      <div className="text-sm mt-4 flex flex-col items-center">
        <a href="/patient/register" className="text-blue-600 hover:underline">
          Créer un compte
        </a>
        <a
          href="/patient/forgot-password"
          className="text-blue-600 hover:underline mt-1"
        >
          Mot de passe oublié ?
        </a>
      </div>

      {message && (
        <p
          className={`mt-4 ${
            message.includes("✅") ? "text-green-600" : "text-red-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
