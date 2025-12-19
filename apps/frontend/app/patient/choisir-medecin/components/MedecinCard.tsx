export default function MedecinCard({ medecin }) {
  return (
    <div className="p-4 border rounded bg-white shadow-sm">
      <h3 className="font-semibold text-lg">
        {medecin.prenom} {medecin.nom}
      </h3>
      <p className="text-sm text-gray-500">{medecin.specialite}</p>

      {medecin.noteMoyenne && (
        <p className="text-yellow-600 mt-1">⭐ {medecin.noteMoyenne}/5</p>
      )}

      <div className="text-sm text-gray-600 mt-2">
        Disponible dès :{" "}
        <span className="font-medium">
          {new Date(medecin.nextAvailable).toLocaleDateString("fr-FR")}
        </span>
      </div>
    </div>
  );
}
