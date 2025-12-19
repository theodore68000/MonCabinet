"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChoisirStatutPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);
  const [proches, setProches] = useState<any[]>([]);

  const getId = () => {
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("id="));
    return cookie ? cookie.split("=")[1] : null;
  };

  useEffect(() => {
    const id = getId();
    if (!id) {
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`http://localhost:3001/patient/${id}`).then((r) => r.json()),
      fetch(`http://localhost:3001/proches/patient/${id}`).then((r) => r.json()),
    ])
      .then(([patientData, prochesData]) => {
        setPatient(patientData);
        setProches(Array.isArray(prochesData) ? prochesData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-6">Chargement...</div>;
  if (!patient) return <div>Erreur chargement patient</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <button
        onClick={() => router.back()}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour
      </button>

      <h1 className="text-2xl font-bold">
        Pour qui prenez-vous rendez-vous ?
      </h1>

      <div className="space-y-4">
        {/* 👤 PATIENT */}
        <div
          onClick={() =>
            router.push("/patient/choisir-medecin?for=patient")
          }
          className="border p-4 rounded-lg cursor-pointer hover:bg-gray-50 transition"
        >
          <div className="font-semibold">
            Moi — {patient.prenom} {patient.nom}
          </div>
          <div className="text-sm text-gray-500">
            Mon rendez-vous personnel
          </div>
        </div>

        {/* 👥 PROCHES */}
        {proches.map((p) => (
          <div
            key={p.id}
            onClick={() =>
              router.push(
                `/patient/choisir-medecin?for=proche&procheId=${p.id}`
              )
            }
            className="border p-4 rounded-lg cursor-pointer hover:bg-gray-50 transition"
          >
            <div className="font-semibold">
              {p.prenom} {p.nom}
            </div>
            <div className="text-sm text-gray-500">
              {p.relation || "Proche"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
