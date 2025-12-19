import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.toLowerCase() || "";

  // Récupère tous les médecins
  const r = await fetch(`${API_URL}/medecin`);
  const medecins = await r.json();

  // Filtre par nom / prénom
  const filtered = medecins.filter((m: any) =>
    `${m.prenom} ${m.nom}`.toLowerCase().includes(q)
  );

  // Renvoie les objets complets (pas des strings)
  const list = filtered.map((m: any) => ({
    id: m.id,
    nom: m.nom,
    prenom: m.prenom,
    specialite: m.specialite ?? null,
  }));

  return NextResponse.json(list);
}

