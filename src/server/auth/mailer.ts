import "server-only";
import nodemailer from "nodemailer";
import { env } from "../env";

export async function sendSignInCode(email: string, code: string) {
  const { SMTP_USER, SMTP_APP_PASSWORD } = env();

  if (!SMTP_USER || !SMTP_APP_PASSWORD) {
    // Only reachable in development: env() requires these settings in production.
    console.info(`[dev] Sign-in code for ${email}: ${code}`);
    return;
  }

  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: SMTP_USER, pass: SMTP_APP_PASSWORD },
  });
  await transport.sendMail({
    from: `Inventory <${SMTP_USER}>`,
    to: email,
    subject: `${code} is your Inventory sign-in code`,
    text: `Your sign-in code is ${code}.\n\nIt expires in 5 minutes. If you didn't ask for it, you can ignore this email.`,
  });
}
