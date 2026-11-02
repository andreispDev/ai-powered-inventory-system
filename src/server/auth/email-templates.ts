// Email layouts. Tables and inline styles, because that's what mail apps reliably support.
// No framework here, so tests can run it directly.

export type EmailContent = { subject: string; text: string; html: string };

const INK = "#0f172a";
const MUTED = "#64748b";
const BRAND = "#1e3a70";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

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
<body style="margin:0;padding:0;background-color:#f1f5f9;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
        <tr>
          <td style="background-color:${BRAND};border-radius:11px 11px 0 0;padding:20px 32px;font-family:${FONT};font-size:17px;font-weight:600;color:#ffffff;">Inventory</td>
        </tr>
        <tr>
          <td style="padding:32px;font-family:${FONT};color:${INK};">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;">${escapeHtml(title)}</h1>
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;font-family:${FONT};font-size:12px;line-height:1.5;color:${MUTED};">${escapeHtml(footnote)}</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

const paragraph = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(text)}</p>`;

export function signInCodeEmail(code: string): EmailContent {
  return {
    subject: `${code} is your Inventory sign-in code`,
    text: `Your sign-in code is ${code}.\n\nIt expires in 5 minutes. If you didn't ask for it, you can ignore this email.`,
    html: layout({
      preview: `Your code is ${code}. It expires in 5 minutes.`,
      title: "Your sign-in code",
      body: `${paragraph("Enter this code on the sign-in page to continue.")}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
              <tr>
                <td align="center" style="background-color:#f1f5f9;border-radius:8px;padding:18px 12px;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND};">${escapeHtml(code)}</td>
              </tr>
            </table>
            ${paragraph("It expires in 5 minutes. Never share this code with anyone, including staff.")}`,
      footnote: "If you didn't ask for this code, you can ignore this email. Nobody can sign in without it.",
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
      body: `${paragraph(message)}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:14px;line-height:1.5;color:#92400e;">${escapeHtml(advice)}</td>
              </tr>
            </table>`,
      footnote: "This is a security notice about your account. You can't reply to change anything here.",
    }),
  };
}
