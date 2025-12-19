"use client";

import "@livekit/components-styles";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RendezVous {
  id: number;
  date: string;
  heure: string;
  typeConsultation: string;
  medecin?: {
    nom: string;
    prenom: string;
  };
  fullDate: Date;
}

export default function PatientVisioList() {
  const router = useRouter();

  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRdvs = async () => {
      const patient = JSON.parse(localStorage.getItem("patient") || "{}");
      const patientId = patient.id;

      if (!patientId) {
        console.warn("Aucun patient identifié");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/rdv/patient/${patientId}`,
          { credentials: "include" }
        );

        const data = await res.json();

        let list = Array.isArray(data)
          ? data
          : Array.isArray(data.rdvs)
          ? data.rdvs
          : [];

        const now = new Date();

        const listWithFullDate: RendezVous[] = list.map((r: any) => {
          const full = new Date(`${r.date.slice(0, 10)}T${r.heure}:00`);
          return { ...r, fullDate: full };
        });

        const visios = listWithFullDate
          .filter((r) => r.typeConsultation === "VISIO")
          .filter((r) => r.fullDate > now)
          .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());

        setRdvs(visios);
      } catch (error) {
        console.warn("Erreur récupération visios patient :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRdvs();
  }, []);

  if (loading)
    return (
      <div className="p-8 text-center text-gray-300">
        Chargement de vos téléconsultations…
      </div>
    );

  return (
    <div className="p-8 text-white">
      {/* 🔙 RETOUR DASHBOARD */}
      <button
        onClick={() => router.push("/patient/dashboard")}
        className="mb-6 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-3xl font-bold text-emerald-400 mb-6">
        Mes téléconsultations à venir
      </h1>

      {rdvs.length === 0 && (
        <p className="text-gray-400">Aucune téléconsultation prévue.</p>
      )}

      <div className="space-y-4">
        {rdvs.map((rdv) => (
          <div
            key={rdv.id}
            className="flex items-center justify-between bg-[#111827] px-6 py-4 rounded-2xl shadow-lg"
          >
            <div>
              <p className="text-gray-400 text-sm">
                {rdv.fullDate.toLocaleString("fr-FR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              <p className="font-medium mt-1">
                {rdv.medecin
                  ? `${rdv.medecin.prenom} ${rdv.medecin.nom}`
                  : "Médecin inconnu"}
              </p>
            </div>

            <Link
              href={`/patient/visio/${rdv.id}`}
              className="bg-emerald-500 hover:bg-emerald-600 text-sm px-4 py-2 rounded-full transition"
            >
              Rejoindre
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
