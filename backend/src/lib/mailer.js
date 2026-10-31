import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transport = nodemailer.createTransport({
  host: env.SMTP.host,
  port: env.SMTP.port,
  secure: env.SMTP.secure,
  auth: env.SMTP.user ? { user: env.SMTP.user, pass: env.SMTP.pass } : undefined,
});

// Never let a mail failure break a business action. Returns true/false.
export async function sendMail({ to, subject, html }) {
  try {
    await transport.sendMail({ from: env.MAIL_FROM, to, subject, html });
    return true;
  } catch (e) {
    console.error('[mail] failed:', e.message);
    return false;
  }
}
