"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function VerifyEmail() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e: any) {
    e.preventDefault();

    const res = await fetch("http://localhost:3001/patient/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = await res.json();

    if (data.success) {
      setMsg("Email vérifié ! Vous pouvez vous connecter.");
      setTimeout(() => (window.location.href = "/patient/login"), 1200);
    } else {
      setMsg(data.message || "Code incorrect");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Vérification email</h1>

      <p>Un code de 6 chiffres a été envoyé à : <b>{email}</b></p>

      <form onSubmit={submit} className="flex flex-col gap-2 w-64 mt-4">
        <input
          type="text"
          maxLength={6}
          placeholder="Code à 6 chiffres"
          className="border p-2 rounded text-center tracking-widest text-xl"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <button className="bg-blue-600 text-white p-2 rounded">
          Vérifier
        </button>
      </form>

      {msg && <p className="mt-4">{msg}</p>}
    </div>
  );
}
