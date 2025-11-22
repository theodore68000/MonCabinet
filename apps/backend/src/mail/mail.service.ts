import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // logs utiles pour debug
    // console.log('MAILER ENV', process.env.SMTP_HOST, process.env.SMTP_USER, !!process.env.SMTP_PASS);

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 2525),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    return this.transporter.sendMail({
      from: `"Cabinet Médical" <no-reply@moncabinet.com>`,
      to,
      subject,
      html,
    });
  }
}
