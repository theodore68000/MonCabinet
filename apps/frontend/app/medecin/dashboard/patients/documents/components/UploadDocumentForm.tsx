"use client";

import { useRef, useState } from "react";

export default function UploadDocumentForm({
  patientId,
  procheId,
  medecinId,
  onUploaded,
}: {
  patientId: number;
  procheId?: number | null;
  medecinId: number;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [titre, setTitre] = useState("");
  const [type, setType] = useState("");

  const submit = async () => {
    if (!file) return alert("Veuillez choisir un fichier");
    if (!titre.trim()) return alert("Titre requis");
    if (!type.trim()) return alert("Type requis");

    const form = new FormData();
    form.append("file", file);
    form.append("titre", titre);
    form.append("type", type);
    form.append("medecinId", String(medecinId));

    // 🔥 CIBLE UNIQUE
    if (procheId) {
      form.append("procheId", String(procheId));
    } else {
      form.append("patientId", String(patientId));
    }

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/document/upload`, {
      method: "POST",
      body: form,
    });

    setFile(null);
    setTitre("");
    setType("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    onUploaded();
  };

  return (
    <div className="mt-6 border p-4 rounded bg-white">
      <h3 className="font-semibold mb-4">Ajouter un document</h3>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="px-4 py-2 border rounded"
      >
        Choisir un fichier
      </button>

      {file && <p className="text-sm mt-1">{file.name}</p>}

      <input
        className="block border p-2 mt-4 w-full rounded"
        placeholder="Titre du document"
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
      />

      <input
        className="block border p-2 mt-2 w-full rounded"
        placeholder="Type (ex : ordonnance)"
        value={type}
        onChange={(e) => setType(e.target.value)}
      />

      <button
        onClick={submit}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Uploader
      </button>
    </div>
  );
}
