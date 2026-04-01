import nodemailer from 'nodemailer';
import config from '../config/config.js';

export function createTransporter() {
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
}

export async function sendEmail(to, subject, htmlContent) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html: htmlContent,
  });
}
