"use client";

import { useRouter } from "next/navigation";

export default function FavorisList({ favoris, removeFavori }) {
  const router = useRouter();

  return (
    <div className="space-y-3">
      {favoris.length === 0 && (
        <p className="text-gray-400">Aucun favori pour l’instant.</p>
      )}

      {favoris.map((f) => (
        <div
          key={f.id}
          onClick={() =>
            router.push(`/patient/rdv?medecinId=${f.id}`)
          }
          className="p-4 bg-gray-100 rounded flex justify-between items-center hover:bg-gray-200 cursor-pointer"
        >
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg">
              {f.prenom} {f.nom}
            </span>

            <span className="text-sm text-gray-700">
              {f.specialite || "Spécialité non renseignée"}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              removeFavori(f.id);
            }}
            className="text-red-500 text-xl font-bold hover:text-red-700"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
