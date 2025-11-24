import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    await this.transporter.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject: "Réinitialisation de votre mot de passe",
      html: `
        <h2>Réinitialisation du mot de passe</h2>
        <p>Pour réinitialiser votre mot de passe, cliquez sur le lien ci-dessous :</p>
        <p><a href="${resetLink}" style="color:blue;font-weight:bold;">Réinitialiser mon mot de passe</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>
      `,
    });
  }
}
