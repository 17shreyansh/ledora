import nodemailer from 'nodemailer';
import type { Config } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import type { RenderedMail } from './templates.js';

export interface MailTransport {
  send(to: string, mail: RenderedMail): Promise<void>;
}

export function createMailTransport(config: Config): MailTransport {
  if (config.MAIL_TRANSPORT === 'smtp') {
    const transporter = nodemailer.createTransport(config.SMTP_URL!);
    return {
      async send(to, mail) {
        await transporter.sendMail({ from: config.MAIL_FROM, to, subject: mail.subject, text: mail.text, html: mail.html });
      },
    };
  }
  // Development only (production config validation rejects it): prints the
  // plain-text body so links can be followed locally. Nothing is delivered.
  return {
    async send(to, mail) {
      logger.info({ to, subject: mail.subject }, `[mail:log transport — not delivered]\n${mail.text}`);
    },
  };
}
