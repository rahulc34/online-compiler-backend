import nodemailer from "nodemailer";
import { config } from "../config";

const requiredEmailConfig = [
  config.email.host,
  config.email.user,
  config.email.password,
  config.email.from,
];

const isEmailConfigured = requiredEmailConfig.every(Boolean);

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.user,
        pass: config.email.password,
      },
    })
  : null;

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export const sendMail = async ({
  to,
  subject,
  html,
  text,
}: SendMailOptions): Promise<void> => {
  if (!transporter || !config.email.from) {
    throw new Error("Email service is not configured");
  }

  await transporter.sendMail({
    from: config.email.from,
    to,
    subject,
    html,
    text,
  });
};
