"use client";

import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface TokenResponse {
  token: string;
  roomName: string;
  patientId: number;
  validFrom?: string;
  validUntil?: string;
}

export default function PatientVisioPage() {
  const { rdvId } = useParams();
  const router = useRouter();

  const [data, setData] = useState<TokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [visioLink, setVisioLink] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setVisioLink(window.location.href);
    }
  }, []);

  useEffect(() => {
    const patientStorage = localStorage.getItem("patient");
    if (!patientStorage) {
      setErrorMsg("Vous devez être connecté.");
      router.push("/patient/login");
      return;
    }

    const patient = JSON.parse(patientStorage);

    const fetchToken = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/visio/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rdvId: Number(rdvId),
              role: "patient",
              userId: patient.id,
            }),
          }
        );

        if (!res.ok) throw new Error("Impossible d'obtenir le token visio");

        const json = await res.json();

        if (json.patientId !== patient.id) {
          setErrorMsg("Accès interdit à cette téléconsultation.");
          setData(null);
          return;
        }

        setData(json);
      } catch (err) {
        console.error("Erreur visio patient:", err);
        setErrorMsg("Impossible de rejoindre la téléconsultation.");
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [rdvId, router]);

  if (loading)
    return (
      <div className="p-8 text-white text-center">
        Connexion à la salle de téléconsultation…
      </div>
    );

  if (errorMsg)
    return (
      <div className="p-8 text-center text-red-400 text-lg">
        {errorMsg}
      </div>
    );

  if (!data)
    return (
      <div className="p-8 text-center text-red-400">
        Une erreur est survenue.
      </div>
    );

  if (data.validFrom && Date.now() < new Date(data.validFrom).getTime()) {
    return (
      <div className="p-8 text-white text-center">
        La téléconsultation n'est pas encore ouverte.<br />
        Vous pourrez rejoindre à partir de{" "}
        <strong>
          {new Date(data.validFrom).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </strong>
        .
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white">

      {/* HEADER */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-semibold text-emerald-400">
            Téléconsultation
          </h1>

          {visioLink && (
            <p className="text-xs text-gray-500 mt-1 break-all">
              Lien de cette session : {visioLink}
            </p>
          )}
        </div>

        <button
          onClick={() => router.push("/patient/dashboard")}
          className="text-sm px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-full"
        >
          Quitter
        </button>
      </div>

      {/* LIVEKIT */}
      <div className="h-[calc(100vh-60px)]">

        {/* FIX CRITIQUE : utiliser data.token */}
        <LiveKitRoom
          token={data.token}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
          connect={true}
          video={true}
          audio={true}
          className="w-full h-full"
        >
          <VideoConference />
        </LiveKitRoom>

      </div>
    </div>
  );
}
