import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // mot de passe d'application Google
      },
    });
  }

  // Méthode générique → utilisée par NotificationService
  async send(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: `"MonCabinet" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  }

  // Email reset mot de passe
  async sendPasswordResetEmail(to: string, resetLink: string) {
    const html = `
      <h2>Réinitialisation de votre mot de passe</h2>
      <p>Pour réinitialiser votre mot de passe, cliquez ici :</p>
      <p>
        <a href="${resetLink}" 
           style="font-size:16px;color:#2563eb;font-weight:bold">
          Réinitialiser mon mot de passe
        </a>
      </p>
      <p>Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
    `;

    return this.send(to, 'Réinitialisation du mot de passe', html);
  }
}
