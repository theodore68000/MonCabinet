"use client";

import { useRouter } from "next/navigation";

export default function PatientDashboard() {
  const router = useRouter();

  const getId = () => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("id="));
    return cookie ? cookie.split("=")[1] : null;
  };

  // ------------------------------
  // 🔒 DÉCONNEXION
  // ------------------------------
  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  // ------------------------------
  // 📅 PRENDRE RDV (LOGIQUE PROCHE)
  // ------------------------------
  const handlePrendreRdv = async () => {
    const id = getId();
    if (!id) {
      alert("Session invalide");
      return;
    }

    try {
      const res = await fetch(
        `http://localhost:3001/proches/patient/${id}`
      );

      if (!res.ok) {
        throw new Error("Erreur récupération proches");
      }

      const proches = await res.json();

      if (Array.isArray(proches) && proches.length > 0) {
        router.push("/patient/choisir-statut");
      } else {
        router.push("/patient/choisir-medecin?for=patient");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la vérification des proches");
    }
  };

  const cards = [
    {
      title: "Prendre un rendez-vous",
      desc: "Choisir un médecin et réserver un créneau",
      color: "bg-blue-600",
      onClick: handlePrendreRdv,
    },
    {
      title: "Mes rendez-vous futurs",
      desc: "Voir les consultations à venir",
      color: "bg-green-600",
      link: "/patient/dashboard/rdv/futurs",
    },
    {
      title: "Mes rendez-vous passés",
      desc: "Historique de vos anciennes consultations",
      color: "bg-yellow-500",
      link: "/patient/dashboard/rdv/passes",
    },
    {
      title: "Mes documents",
      desc: "Ordonnances, résultats, comptes-rendus",
      color: "bg-purple-600",
      link: "/patient/dashboard/document",
    },
    {
      title: "Mes liens visio",
      desc: "Accéder aux téléconsultations prévues",
      color: "bg-red-600",
      link: "/patient/visio",
    },
    {
      title: "Mon profil",
      desc: "Modifier mes informations personnelles",
      color: "bg-teal-600",
      link: "/patient/dashboard/profil",
    },
    {
      title: "Mes proches",
      desc: "Enfants, parents, conjoints, aidés",
      color: "bg-indigo-600",
      link: "/patient/dashboard/proches",
    },
  ];

  return (
    <div className="relative flex flex-col items-center py-16 px-4 bg-gray-50 min-h-screen">
      {/* 🔓 LOGOUT */}
      <button
        onClick={handleLogout}
        className="absolute top-6 right-6 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
      >
        Se déconnecter
      </button>

      <h1 className="text-3xl font-bold mb-10">Dashboard Patient</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {cards.map((c, i) => (
          <div
            key={i}
            onClick={() =>
              c.onClick ? c.onClick() : router.push(c.link!)
            }
            className={`${c.color} cursor-pointer text-white p-6 rounded-2xl shadow-lg hover:opacity-90 transition`}
          >
            <h2 className="text-xl font-semibold">{c.title}</h2>
            <p className="text-sm mt-2 opacity-90">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
