// src/notification/templates.ts

export interface RdvTemplatePayload {
  prenom: string;
  medecin: string;
  date: string;
  heure: string;
  appUrl: string;
}

// Confirmation
export function rdvConfirmationTemplate(payload: RdvTemplatePayload): string {
  const { prenom, medecin, date, heure, appUrl } = payload;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color:#0070f3;">Confirmation de votre rendez-vous</h2>

    <p>Bonjour ${prenom},</p>

    <p>Votre rendez-vous est bien confirmé :</p>

    <div style="background:#f7f9fc; padding:12px; border-radius:6px; margin-top:10px;">
      <p style="margin:6px 0;"><strong>Médecin :</strong> Dr ${medecin}</p>
      <p style="margin:6px 0;"><strong>Date :</strong> ${date}</p>
      <p style="margin:6px 0;"><strong>Heure :</strong> ${heure}</p>
    </div>

    <p style="margin-top:20px;">
      Vous pouvez gérer vos rendez-vous depuis votre espace en ligne :
      <a href="${appUrl}" style="color:#0070f3;">accéder à mon espace</a>
    </p>

    <p style="font-size:12px; color:#777; margin-top:20px;">Ceci est un email automatique, merci de ne pas y répondre.</p>
  </div>
  `;
}

// Annulation
export function rdvAnnulationTemplate(payload: RdvTemplatePayload): string {
  const { prenom, medecin, date, heure, appUrl } = payload;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color:#e63946;">Annulation de votre rendez-vous</h2>

    <p>Bonjour ${prenom},</p>

    <p>Votre rendez-vous avec Dr ${medecin}, prévu le ${date} à ${heure}, a été <strong>annulé</strong>.</p>

    <p style="margin-top:20px;">
      Si vous souhaitez reprendre rendez-vous, vous pouvez le faire directement en ligne :
      <a href="${appUrl}" style="color:#0070f3;">reprendre rendez-vous</a>
    </p>

    <p style="font-size:12px; color:#777; margin-top:20px;">Ceci est un email automatique, merci de ne pas y répondre.</p>
  </div>
  `;
}

// Modification
export function rdvModificationTemplate(payload: RdvTemplatePayload): string {
  const { prenom, medecin, date, heure, appUrl } = payload;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color:#ff9f1c;">Votre rendez-vous a été modifié</h2>

    <p>Bonjour ${prenom},</p>

    <p>Les informations de votre rendez-vous ont été mises à jour :</p>

    <div style="background:#fff4e6; padding:12px; border-radius:6px; margin-top:10px;">
      <p style="margin:6px 0;"><strong>Médecin :</strong> Dr ${medecin}</p>
      <p style="margin:6px 0;"><strong>Nouvelle date :</strong> ${date}</p>
      <p style="margin:6px 0;"><strong>Nouvelle heure :</strong> ${heure}</p>
    </div>

    <p style="margin-top:20px;">
      Vous pouvez consulter le détail de vos rendez-vous ici :
      <a href="${appUrl}" style="color:#0070f3;">voir mes rendez-vous</a>
    </p>

    <p style="font-size:12px; color:#777; margin-top:20px;">Ceci est un email automatique, merci de ne pas y répondre.</p>
  </div>
  `;
}

// Rappel 24h avant
export function rdvRappelTemplate(payload: RdvTemplatePayload): string {
  const { prenom, medecin, date, heure, appUrl } = payload;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <h2 style="color:#007f5f;">Rappel : votre rendez-vous approche</h2>

    <p>Bonjour ${prenom},</p>

    <p>Petit rappel : vous avez un rendez-vous à venir :</p>

    <div style="background:#e6f7f1; padding:12px; border-radius:6px; margin-top:10px;">
      <p style="margin:6px 0;"><strong>Médecin :</strong> Dr ${medecin}</p>
      <p style="margin:6px 0;"><strong>Date :</strong> ${date}</p>
      <p style="margin:6px 0;"><strong>Heure :</strong> ${heure}</p>
    </div>

    <p style="margin-top:20px;">
      En cas d'empêchement, merci d'annuler ou de modifier votre rendez-vous depuis votre espace :
      <a href="${appUrl}" style="color:#0070f3;">gérer mon rendez-vous</a>
    </p>

    <p style="font-size:12px; color:#777; margin-top:20px;">Ceci est un email automatique, merci de ne pas y répondre.</p>
  </div>
  `;
}
