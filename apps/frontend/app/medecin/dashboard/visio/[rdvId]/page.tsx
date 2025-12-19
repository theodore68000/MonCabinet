"use client";

import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface TokenResponse {
  token: string;
  roomName: string;
  validFrom?: string;
  validUntil?: string;
}

export default function VisioCallPage() {
  const { rdvId } = useParams();
  const router = useRouter();

  const [data, setData] = useState<TokenResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [visioLinkPatient, setVisioLinkPatient] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined" && rdvId) {
      setVisioLinkPatient(
        `${window.location.origin}/patient/visio/${rdvId}`
      );
    }
  }, [rdvId]);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const medecinId = localStorage.getItem("medecinId");
        if (!medecinId) {
          router.push("/medecin/login");
          return;
        }

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/visio/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rdvId: Number(rdvId),
              role: "medecin",
              userId: Number(medecinId),
            }),
          }
        );

        if (!res.ok) throw new Error("Impossible d'obtenir le token visio");

        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [rdvId, router]);

  if (loading)
    return (
      <div className="p-8 text-white">Connexion à la salle visio…</div>
    );

  if (!data)
    return (
      <div className="p-8 text-red-400">
        Erreur lors de la connexion à la visio.
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
    <div className="h-[calc(100vh-2rem)] p-4">
      <div className="bg-[#020617] h-full rounded-3xl flex flex-col overflow-hidden shadow-xl">

        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">
              Téléconsultation
            </h1>
            <p className="text-xs text-gray-400">Salle : {data.roomName}</p>

            {visioLinkPatient && (
              <p className="text-xs text-gray-500 mt-1 break-all">
                Lien patient : {visioLinkPatient}
              </p>
            )}
          </div>

          <button
            onClick={() => router.push("/medecin/dashboard/visio")}
            className="text-sm px-4 py-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition"
          >
            Quitter
          </button>
        </div>

        {/* LIVEKIT */}
        <div className="flex-1">

          {/* FIX CRITIQUE : on passe bien data.token */}
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
    </div>
  );
}
