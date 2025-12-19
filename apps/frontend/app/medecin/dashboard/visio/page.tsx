"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RendezVous {
  id: number;
  date: string; // ISO
  heure: string;
  patient?: {
    nom: string;
    prenom: string;
  };
  typeConsultation: string;
  fullDate: Date;
}

export default function VisioPage() {
  const router = useRouter(); // 🔹 AJOUT

  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem("medecinSession");
    if (!session) return;

    const medecinId = JSON.parse(session).id;
    if (!medecinId) return;

    const fetchRdv = async () => {
      const now = new Date();

      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();

      const end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      ).toISOString();

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/rdv/medecin/${medecinId}?start=${start}&end=${end}`,
          { credentials: "include" }
        );

        const data = await res.json();

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.rdvs)
          ? data.rdvs
          : [];

        const listWithFullDate: RendezVous[] = list.map((r: any) => {
          const full = new Date(`${r.date.slice(0, 10)}T${r.heure}:00`);
          return { ...r, fullDate: full };
        });

        const today = new Date();

        const todayVisio = listWithFullDate
          .filter((r) => r.typeConsultation === "VISIO")
          .filter((r) => {
            return (
              r.fullDate.getFullYear() === today.getFullYear() &&
              r.fullDate.getMonth() === today.getMonth() &&
              r.fullDate.getDate() === today.getDate()
            );
          })
          .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());

        setRdvs(todayVisio);
      } catch (e) {
        console.error("Erreur fetch Visios du jour :", e);
      } finally {
        setLoading(false);
      }
    };

    fetchRdv();
  }, []);

  return (
    <div className="p-8 text-white">
      {/* 🔙 RETOUR DASHBOARD */}
      <button
        onClick={() => router.push("/medecin/dashboard")}
        className="mb-6 px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-3xl font-bold text-emerald-400 mb-6">
        Téléconsultations du jour
      </h1>

      {loading && <p>Chargement…</p>}

      {!loading && rdvs.length === 0 && (
        <p className="text-gray-400">Aucune téléconsultation prévue.</p>
      )}

      <div className="space-y-4">
        {rdvs.map((rdv) => (
          <div
            key={rdv.id}
            className="flex items-center justify-between bg-[#111827] px-6 py-4 rounded-2xl shadow-lg"
          >
            <div>
              <div className="text-gray-400 text-sm">
                {rdv.fullDate.toLocaleString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  day: "2-digit",
                  month: "2-digit",
                })}
              </div>
              <div className="font-medium">
                {rdv.patient
                  ? `${rdv.patient.prenom} ${rdv.patient.nom}`
                  : "Patient inconnu"}
              </div>
            </div>

            <Link
              href={`/medecin/dashboard/visio/${rdv.id}`}
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
