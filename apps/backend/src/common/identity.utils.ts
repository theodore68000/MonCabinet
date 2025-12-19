export function normalize(str: string): string {
  return str
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/\s+/g, "")             // espaces
    .toLowerCase();
}

export function identitiesMatch(
  nom1: string,
  prenom1: string,
  date1: string,
  nom2: string,
  prenom2: string,
  date2: string,
): boolean {
  return (
    normalize(nom1) === normalize(nom2) &&
    normalize(prenom1) === normalize(prenom2) &&
    date1 === date2
  );
}
