export const RDV_MOTIFS = [
  'Douleur',
  'Symptômes grippaux',
  'Rhume / mal de gorge',
  'Problème digestif',
  'Fatigue persistante',
  'Fièvre',
  'Suivi de maladie chronique',
  'Renouvellement d’ordonnance',
  'Certificat médical',
  'Problème cutané',
  'Infection urinaire',
  'Douleur thoracique / essoufflement',
  'Problème ORL',
  'Problème ophtalmologique',
  'Problème gynécologique / urologique',
  'Vaccination',
  'Bilan de santé',
  'Autre',
] as const;

export type RdvMotif = (typeof RDV_MOTIFS)[number];
