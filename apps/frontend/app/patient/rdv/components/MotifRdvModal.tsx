"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (motif: string) => void;
};

export default function MotifRdvModal({ open, onClose, onConfirm }: Props) {
  const [motifs, setMotifs] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (!open) return;

    fetch("http://localhost:3001/rdv/motifs")
      .then((r) => r.json())
      .then(setMotifs)
      .catch(() => setMotifs([]));
  }, [open]);

  if (!open) return null;

  const isAutre = selected === "Autre";
  const finalMotif = isAutre ? custom.trim() : selected;

  const canConfirm =
    !!finalMotif && (!isAutre || (custom.length > 0 && custom.length <= 20));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-md p-5">
        <h2 className="text-xl font-semibold mb-4">Motif du rendez-vous</h2>

        <div className="flex flex-col gap-2 max-h-64 overflow-auto mb-3">
          {motifs.map((m) => (
            <button
              key={m}
              onClick={() => {
                setSelected(m);
                setCustom("");
              }}
              className={`px-3 py-2 rounded border text-left ${
                selected === m
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {isAutre && (
          <div className="mb-3">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, 20))}
              placeholder="Précisez (20 caractères max)"
              className="w-full border rounded px-3 py-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              {custom.length}/20
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Annuler
          </button>

          <button
            disabled={!canConfirm}
            onClick={() => finalMotif && onConfirm(finalMotif)}
            className={`px-4 py-2 rounded text-white ${
              canConfirm
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
