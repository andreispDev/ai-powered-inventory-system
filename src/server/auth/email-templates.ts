// Email layouts. Tables and inline styles, because that's what mail apps reliably support.
// No framework here, so tests can run it directly.

export type EmailContent = { subject: string; text: string; html: string };

// Arial is on nearly every computer and phone, so the email looks the same everywhere and loads no web font.
const FONT = "Arial,Helvetica,sans-serif";

const PAGE = "#f4f4f5";
const CARD = "#ffffff";
const INK = "#18181b";
const BODY = "#3f3f46";
const QUIET = "#71717a";
const LINE = "#e4e4e7";
const CODE_BG = "#f4f4f5";
// A thin accent bar under the title, darkest at the left.
const BAR = "linear-gradient(90deg, #1c1917 0%, #57534e 55%, #a8a29e 100%)";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout({ preview, title, body, footnote }: { preview: string; title: string; body: string; footnote: string }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${CARD};border:1px solid ${LINE};border-radius:8px;font-family:${FONT};">
        <tr><td align="center" style="padding:36px 40px 0;font-size:22px;font-weight:bold;letter-spacing:-0.01em;color:${INK};">Inventory</td></tr>
        <tr><td align="center" style="padding:28px 40px 20px;"><h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:normal;color:${INK};">${escapeHtml(title)}</h1></td></tr>
        <tr><td style="padding:0 40px;"><div style="height:8px;border-radius:4px;background-color:#57534e;background-image:${BAR};"></div></td></tr>
        <tr><td align="center" style="padding:32px 40px 8px;font-size:16px;line-height:1.6;color:${BODY};">${body}</td></tr>
        <tr><td style="padding:0 40px 32px;"><div style="padding-top:20px;border-top:1px solid ${LINE};font-size:12px;line-height:1.6;color:${QUIET};text-align:center;">${escapeHtml(footnote)}</div></td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:${FONT};">
        <tr><td align="center" style="padding:20px 40px 0;font-size:12px;line-height:1.6;color:${QUIET};">You are receiving this email because of activity on your Inventory account.</td></tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const paragraph = (text: string) => `<p style="margin:0 0 24px;">${escapeHtml(text)}</p>`;

export function signInCodeEmail(code: string): EmailContent {
  return {
    subject: `${code} is your Inventory sign-in code`,
    text: `Your sign-in code is ${code}.\n\nIt expires in 5 minutes. If you didn't ask for it, you can ignore this email.`,
    html: layout({
      preview: `Your code is ${code}. It expires in 5 minutes.`,
      title: "Your sign-in code",
      body: `${paragraph("Enter this code to sign in. It expires in 5 minutes.")}
        <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px;"><tr><td style="padding:16px 28px;background-color:${CODE_BG};border:1px solid ${LINE};border-radius:6px;font-family:${FONT};font-size:34px;line-height:1;font-weight:bold;letter-spacing:0.2em;color:${INK};">${escapeHtml(code)}</td></tr></table>`,
      footnote: "If you didn't ask for this, you can ignore it. Never share this code with anyone.",
    }),
  };
}

export function emailChangedEmail(): EmailContent {
  const message = "An administrator changed the email address for your Inventory account, so this address can no longer sign in.";
  const advice = "If you didn't expect this, contact your administrator.";
  return {
    subject: "Your Inventory sign-in email was changed",
    text: `${message}\n\n${advice}`,
    html: layout({
      preview: "This address can no longer sign in to Inventory.",
      title: "Your sign-in email was changed",
      body: `${paragraph(message)}${paragraph(advice)}`,
      footnote: "This is a security notice about your account.",
    }),
  };
}
