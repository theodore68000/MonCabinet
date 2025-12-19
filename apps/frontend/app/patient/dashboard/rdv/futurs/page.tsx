"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function formatDateFr(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const normalize = (v?: string) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function RdvFutursPage() {
  const router = useRouter();

  const [rdvs, setRdvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [patientIdentity, setPatientIdentity] = useState<{
    nom?: string;
    prenom?: string;
  } | null>(null);

  // 🔹 lecture patient (1 seule fois)
  useEffect(() => {
    const p =
      localStorage.getItem("patient") ??
      localStorage.getItem("patientSession");

    if (!p) return;

    try {
      const parsed = JSON.parse(p);
      setPatientId(Number(parsed.id));
      setPatientIdentity({
        nom: parsed.nom,
        prenom: parsed.prenom,
      });
    } catch {
      setPatientId(null);
      setPatientIdentity(null);
    }
  }, []);

  // 🔹 fetch RDV (deps FIXES)
  useEffect(() => {
    if (!patientId || !patientIdentity) return;

    const load = async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/rdv/patient/${patientId}?type=futurs`,
          { cache: "no-store" }
        );

        const data = await res.json();
        if (!Array.isArray(data)) {
          setRdvs([]);
          return;
        }

        // ✅ FILTRAGE MÉTIER STRICT
        const filtered = data.filter((rdv) => {
          if (rdv.patientId === patientId) return true;
          if (rdv.proche) return true;

          if (rdv.patientIdentity) {
            return (
              normalize(rdv.patientIdentity.nom) ===
                normalize(patientIdentity.nom) &&
              normalize(rdv.patientIdentity.prenom) ===
                normalize(patientIdentity.prenom)
            );
          }

          return false;
        });

        setRdvs(filtered);
      } catch {
        setRdvs([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [patientId, patientIdentity]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button
        onClick={() => router.push("/patient/dashboard")}
        className="mb-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        ← Retour au dashboard
      </button>

      <h1 className="text-2xl font-bold mb-6">Mes rendez-vous futurs</h1>

      {loading ? (
        <p>Chargement...</p>
      ) : rdvs.length === 0 ? (
        <p className="text-gray-600">Aucun rendez-vous à venir.</p>
      ) : (
        <div className="space-y-4">
          {rdvs.map((rdv) => {
            const targetLabel = rdv.proche
              ? `${rdv.proche.prenom} ${rdv.proche.nom}`
              : "Moi";

            return (
              <div
                key={rdv.id}
                className="bg-white p-5 rounded-xl shadow border border-gray-200"
              >
                <h2 className="font-semibold text-lg">
                  Dr {rdv.medecin?.prenom} {rdv.medecin?.nom}
                </h2>

                <p className="text-sm text-gray-600 mt-2">
                  {formatDateFr(rdv.date)} — {rdv.heure}
                </p>

                <p className="mt-2 text-sm text-gray-800">
                  <span className="font-medium">Pour :</span> {targetLabel}
                </p>

                <p className="text-sm mt-2">
                  Statut :{" "}
                  <span className="font-medium text-blue-600">
                    {rdv.typeSlot}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
