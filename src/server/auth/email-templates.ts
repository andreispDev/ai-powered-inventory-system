// Email layouts. Tables and inline styles, because that's what mail apps reliably support.
// No framework here, so tests can run it directly.

export type EmailContent = { subject: string; text: string; html: string };

// Geist where the reader has it, or the closest system sans-serif. Loading it from a web
// font would tell an outside server who opened the email, and most mail apps block it anyway.
const FONT = "Geist,'Geist Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// The stone palette, on a gray-to-black gradient.
const TOP = "#44403c";
const BOTTOM = "#0c0a09";
const TEXT = "#fafaf9";
const SOFT = "#d6d3d1";
const QUIET = "#a8a29e";
const LINE = "#57534e";

// A fine grain, built in so it loads nothing from outside. Mail apps that drop it still show the gradient.
const NOISE = "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgAQMAAADYVuV7AAAABlBMVEX///////9VfPVsAAAAAnRSTlMACQ9PdZwAAATrSURBVHjaAeAEH/sAk8JbzXyEeLKFZWSlAA56UL3D3k16IeX84QDaUUGvw28LIiAMt1AA/4+ZnLnrLBo5UNnbAA5In3Um4v5GF3adIwDRLpmtf7yAOz7h8bkAaeRH+6EHClwpSz+mABmT2wSw9lHCmIgVuQAHtUHwJNyyfmaYaB8AyZ7LRwO/pbpcpT8aACZ9UKu2wGLeuOJLLAAJFpd8oADDjYpN9SMAmALen3kHV05qJ4NIAN9Yu/cOHDLhs2ag3wDXN5yExCI3bPlmvqgAQyS84j1mt5Jq0ZugAATJziveg5oiiwlUcABn+hA+xc+G6PhnhRkAHtPGY2UTQXg2A0IpAJt69Ye/tLceCJzlogADhBpTPLrtglXZNGgAzE1V9KOENjshPutbAPIiEmil6KPUVWZGRQD74BtyN6+ogRBIKNQAqTOa5ssg5nskEOKQALt1YkqzzqFN0Ob+FQDJeqzzPTVAxIL8XuoAg1+DTInGGIXzxxJjAM02EHfwghiixtVXnwA7vgoz519Jle0+btYAG0GBmSY4HrLrl/rKAJJgWOgprN2ade7WYAAttDwKeSP3MbRfv0cA9UB8lYmXMgQYF2k+AJXHAO7ukQgDE8mm3wCiD31FC8SyEmRHkwQAYp4RQ6yQlaeAMD/EAGvCczbmeQUwTlQJBwABrWOUF710Hll2bxUAiF3FrSHKdpquYkKaAAN6/gNf0K6bpiqaLAAW6LwPOgj47I/wGQMAWzzy757H65vRYRMQAFWYSXLb4h0chHUtQAC7KAOH2XvnkgwLydsAhia8Y9BDi/TvQrAJAEnuwm6KZvpqHYly+wAWpWx1nSkeg36amXgAfL0zsD4HpOBDOze2ADm8CVLESCyI5kIFuwDNqq/4p/8my8eIqGcAJJ446lPSjpVgTV0tAI6gtwVDOGiH10Db5wDFI1tU4hJ25DqVYLkArppZbIXhhVhd53jQADRkCdrlRylEKXli7ABTKiyv/hbqpQBxxsAAqWlZfFCquzhukOa8AJfu0lONMIxQQcbgqQDCzqcFTN2+9eCWHnYAjbHhe6FE3nHqt5qDAMofr7yUYBuw/wOqVQDC9aGosZW9yHcNg+IApJG3+Pa4DFzuGgCbALt9b20ovBJyQ/4xYwAYOc7C+Ofch85FiIMAN6aN+HGUuYQf9VbmAPLUHdaKXZ5odFtF2QCwVP2r6WntyI0774sAaWtWMIj35yDO9uXEAMcOpGyOEhF8dmmttQDATIx95BTDQmNaolEATRCy1bmq9vdVFkuXAJGigy6EdkHAxfBP1QA+kURXIV6UTLpYHhQAPDajXqwbqZA19TxiAMMTqpsiN/8dXeaThABTaMXxEXXw7m3ogNcAo9949ccJ/PgkjDkwAHQvbzlul7IjWngGwADlbyDLFwao7gl0SeAALwJK0AJxSG+JpL91AKuNnO1SLIzfGhad6wCU+9mjDT2GjpbX1OAAobFpZiRPodvV9vOeAF0qrJPv14bkuzFG+wBBdzx6bDGp8UjOsq4A8cUTZu0ZzQYbswzeAAG4XV0b0lZwB/mauQAak9lZkoJ0W/PdQSkAFl5VnEPR6tw74LZPALr35seUvmln/3i+owBg1EGK0XWr7OIY11EAu0B867Mt9++/RYDxAFzaLC80rJAXMlq+hwD6O81WrpcSglraXPggvUhqZ0bdiAAAAABJRU5ErkJggg==";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function layout({ preview, title, body, footnote }: { preview: string; title: string; body: string; footnote: string }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<style>
body { background-image: url(data:image/png;base64,${NOISE}) !important; }
.grain { background-image: url(data:image/png;base64,${NOISE}), linear-gradient(180deg, ${TOP} 0%, ${BOTTOM} 100%) !important; }
</style>
</head>
<body style="margin:0;padding:0;background-color:${BOTTOM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BOTTOM};">
  <tr>
    <td class="grain" align="center" style="padding:56px 24px;background-color:${BOTTOM};background-image:linear-gradient(180deg, ${TOP} 0%, ${BOTTOM} 100%);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;font-family:${FONT};">
        <tr><td style="padding:0 0 40px;font-size:14px;font-weight:500;letter-spacing:-0.01em;color:${SOFT};">Inventory</td></tr>
        <tr><td><h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:${TEXT};">${escapeHtml(title)}</h1></td></tr>
        <tr><td style="font-size:15px;line-height:1.6;color:${SOFT};">${body}</td></tr>
        <tr><td style="padding:24px 0 0;margin-top:8px;border-top:1px solid ${LINE};font-size:12px;line-height:1.6;color:${QUIET};">${escapeHtml(footnote)}</td></tr>
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
        <p style="margin:0 0 32px;font-size:40px;line-height:1.1;font-weight:600;letter-spacing:0.14em;color:${TEXT};">${escapeHtml(code)}</p>`,
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
