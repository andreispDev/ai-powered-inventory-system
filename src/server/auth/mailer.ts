import "server-only";
import nodemailer from "nodemailer";
import { env } from "../env";
import { emailChangedEmail, signInCodeEmail } from "./email-templates";

function transporter() {
  const { SMTP_USER, SMTP_APP_PASSWORD } = env();
  if (!SMTP_USER || !SMTP_APP_PASSWORD) return null;
  return {
    from: `Inventory <${SMTP_USER}>`,
    transport: nodemailer.createTransport({ service: "gmail", auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD } }),
  };
}

export async function sendSignInCode(email: string, code: string) {
  const mail = transporter();
  if (!mail) {
    // Only reachable in development: env() requires these settings in production.
    console.info(`[dev] Sign-in code for ${email}: ${code}`);
    return;
  }
  await mail.transport.sendMail({
    from: mail.from,
    to: email,
    ...signInCodeEmail(code),
  });
}

/** Goes to the old address, so someone whose email was changed without their knowledge finds out. */
export async function sendEmailChangedNotice(oldEmail: string) {
  const mail = transporter();
  if (!mail) {
    console.info(`[dev] Email change notice sent to ${oldEmail}`);
    return;
  }
  await mail.transport.sendMail({
    from: mail.from,
    to: oldEmail,
    ...emailChangedEmail(),
  });
}
