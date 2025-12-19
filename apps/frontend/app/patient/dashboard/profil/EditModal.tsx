"use client";

import { useMemo, useState } from "react";

export default function EditModal({ field, value, onClose, onSave }: any) {
  const initial = value ?? "";

  const formatPhoneDisplay = (val: string) =>
    val
      .replace(/\D/g, "")
      .slice(0, 10)
      .replace(/(\d{2})(?=\d)/g, "$1 ")
      .trim();

  const initialDisplayed = useMemo(() => {
    if (field === "telephone") return formatPhoneDisplay(String(initial));
    return String(initial);
  }, [field]);

  const [input, setInput] = useState(initialDisplayed);
  const [error, setError] = useState("");

  const validateEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const validatePhone = (s: string) => {
    const digits = s.replace(/\D/g, "");
    return digits.length === 10;
  };

  const handleSave = () => {
    setError("");

    if (field === "email") {
      const v = input.trim();
      if (!validateEmail(v)) return setError("Format email invalide (mail@example.xxx)");
      return onSave(v);
    }

    if (field === "telephone") {
      if (!validatePhone(input)) return setError("Téléphone invalide (10 chiffres)");
      const digits = input.replace(/\D/g, "");
      return onSave(digits); // backend reçoit digits only
    }

    // adresse (libre)
    return onSave(input);
  };

  const label = field === "email" ? "Email" : field === "telephone" ? "Téléphone" : "Adresse";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Modifier {label}</h2>

        <input
          type="text"
          value={input}
          onChange={(e) =>
            setInput(field === "telephone" ? formatPhoneDisplay(e.target.value) : e.target.value)
          }
          className="border w-full p-2 rounded mb-2"
        />

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">
            Annuler
          </button>

          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
