"use client";

import { useRouter } from "next/navigation";

type FavorisListProps = {
  favoris: any[];
  removeFavori: (id: number) => void;
};

export default function FavorisList({ favoris, removeFavori }: FavorisListProps) {
  const router = useRouter();

  const goToRdv = (medecinId: number) => {
    const params = new URLSearchParams(window.location.search);

    const qs = new URLSearchParams();
    qs.set("medecinId", String(medecinId));

    // ✅ PROPAGATION DU CONTEXTE (patient / proche)
    const forWho = params.get("for");
    const procheId = params.get("procheId");

    if (forWho) qs.set("for", forWho);
    if (procheId) qs.set("procheId", procheId);

    const url = `/patient/rdv?${qs.toString()}`;

    /**
     * 🔥 FIX CRITIQUE (App Router)
     * - push seul ne remount PAS la page si seule la query change
     * - replace + refresh force un cycle propre
     * - supprime le besoin "aller / retour"
     */
    router.replace(url);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {favoris.length === 0 && (
        <p className="text-gray-400">Aucun favori pour l’instant.</p>
      )}

      {favoris.map((f) => (
        <div
          key={f.id}
          onClick={() => goToRdv(f.id)}
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
