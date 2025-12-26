import type { RdvMotif } from './motifs';

export type FormField = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  required?: boolean;
};

export const MOTIF_FORMS: Partial<Record<RdvMotif, FormField[]>> = {
  Douleur: [
    { key: 'localisation', label: 'Où se situe la douleur ?', type: 'text', required: true },
    { key: 'intensite', label: 'Intensité de la douleur (0 à 10)', type: 'number', required: true },
    { key: 'duree', label: 'Depuis combien de temps ?', type: 'text' },
    { key: 'facteurs', label: 'Facteurs aggravants ou calmants', type: 'textarea' },
  ],

  'Symptômes grippaux': [
    { key: 'fievre', label: 'Avez-vous de la fièvre ?', type: 'text' },
    { key: 'toux', label: 'Présentez-vous une toux ?', type: 'text' },
    { key: 'courbatures', label: 'Courbatures ou douleurs musculaires ?', type: 'text' },
    { key: 'fatigue', label: 'Fatigue importante ?', type: 'text' },
    { key: 'duree', label: 'Depuis combien de jours ?', type: 'number' },
  ],

  'Rhume / mal de gorge': [
    { key: 'nez', label: 'Nez bouché ou qui coule ?', type: 'text' },
    { key: 'gorge', label: 'Mal de gorge ?', type: 'text' },
    { key: 'fievre', label: 'Fièvre ?', type: 'text' },
    { key: 'duree', label: 'Durée des symptômes (jours)', type: 'number' },
  ],

  'Problème digestif': [
    { key: 'douleur_abdominale', label: 'Douleur abdominale ?', type: 'text' },
    { key: 'nausees', label: 'Nausées / vomissements ?', type: 'text' },
    { key: 'diarrhee', label: 'Diarrhée ?', type: 'text' },
    { key: 'duree', label: 'Depuis combien de temps ?', type: 'number' },
  ],

  'Fatigue persistante': [
    { key: 'duree', label: 'Depuis combien de temps ?', type: 'text', required: true },
    { key: 'sommeil', label: 'Qualité du sommeil', type: 'text' },
    { key: 'stress', label: 'Stress ou surcharge récente ?', type: 'text' },
  ],

  Fièvre: [
    { key: 'temperature', label: 'Température maximale (°C)', type: 'number', required: true },
    { key: 'duree', label: 'Durée de la fièvre (jours)', type: 'number' },
    { key: 'autres_symptomes', label: 'Autres symptômes associés', type: 'textarea' },
  ],

  'Suivi de maladie chronique': [
    { key: 'maladie', label: 'Quelle maladie ?', type: 'text', required: true },
    { key: 'evolution', label: 'Évolution récente', type: 'textarea' },
    { key: 'traitement', label: 'Traitement actuel', type: 'textarea' },
  ],

  'Renouvellement d’ordonnance': [
    { key: 'medicaments', label: 'Médicaments à renouveler', type: 'textarea', required: true },
    { key: 'changement', label: 'Souhaitez-vous une modification ?', type: 'text' },
  ],

  'Certificat médical': [
    { key: 'motif_certificat', label: 'Motif du certificat', type: 'textarea', required: true },
    { key: 'dates', label: 'Dates concernées', type: 'text' },
  ],

  'Problème cutané': [
    { key: 'localisation', label: 'Zone concernée', type: 'text' },
    { key: 'aspect', label: 'Aspect (rougeur, boutons, démangeaisons…)', type: 'textarea' },
    { key: 'duree', label: 'Depuis combien de temps ?', type: 'number' },
  ],

  'Infection urinaire': [
    { key: 'brulures', label: 'Brûlures à la miction ?', type: 'text' },
    { key: 'frequence', label: 'Envies fréquentes ?', type: 'text' },
    { key: 'fievre', label: 'Fièvre associée ?', type: 'text' },
  ],

  'Douleur thoracique / essoufflement': [
    { key: 'douleur', label: 'Douleur thoracique ?', type: 'text', required: true },
    { key: 'essoufflement', label: 'Essoufflement ?', type: 'text' },
    { key: 'effort', label: 'Survient à l’effort ou au repos ?', type: 'text' },
  ],

  'Problème ORL': [
    { key: 'oreille', label: 'Douleur d’oreille ?', type: 'text' },
    { key: 'sinus', label: 'Douleur des sinus ?', type: 'text' },
    { key: 'fievre', label: 'Fièvre ?', type: 'text' },
  ],

  'Problème ophtalmologique': [
    { key: 'oeil', label: 'Œil concerné', type: 'text' },
    { key: 'douleur', label: 'Douleur ou gêne ?', type: 'text' },
    { key: 'vision', label: 'Baisse de vision ?', type: 'text' },
  ],

  'Problème gynécologique / urologique': [
    { key: 'symptomes', label: 'Description des symptômes', type: 'textarea', required: true },
    { key: 'douleur', label: 'Douleur ?', type: 'text' },
    { key: 'saignement', label: 'Saignements anormaux ?', type: 'text' },
  ],

  Vaccination: [
    { key: 'vaccin', label: 'Quel vaccin ?', type: 'text', required: true },
    { key: 'rappel', label: 'Primo-injection ou rappel ?', type: 'text' },
  ],

  'Bilan de santé': [
    { key: 'objectif', label: 'Objectif du bilan', type: 'textarea', required: true },
    { key: 'antecedents', label: 'Antécédents importants', type: 'textarea' },
  ],

  // 🔥 FORMULAIRE GÉNÉRAL
  Autre: [
    {
      key: 'description',
      label: 'Merci de décrire vos symptômes ou votre demande',
      type: 'textarea',
      required: true,
    },
    {
      key: 'duree',
      label: 'Depuis quand ?',
      type: 'text',
    },
    {
      key: 'questions',
      label: 'Questions pour le médecin',
      type: 'textarea',
    },
  ],
};
