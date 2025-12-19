import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const r = await fetch(`${API_URL}/medecins/search-names?q=${q}`);
  const data = await r.json();

  return NextResponse.json(data);
}
