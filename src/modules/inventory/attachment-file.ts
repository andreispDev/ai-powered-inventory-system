// What may be attached to a record. No database or framework here, so tests can run it directly.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_RECORD = 20;

const OFFICE_XML = (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const OFFICE_OLD = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
const PLAIN_TEXT = (b: Buffer) => !b.includes(0);

const TYPES: Record<string, { type: string; matches: (bytes: Buffer) => boolean }> = {
  pdf: { type: "application/pdf", matches: (b) => b.toString("latin1", 0, 5) === "%PDF-" },
  doc: { type: "application/msword", matches: OFFICE_OLD },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", matches: OFFICE_XML },
  xls: { type: "application/vnd.ms-excel", matches: OFFICE_OLD },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", matches: OFFICE_XML },
  ppt: { type: "application/vnd.ms-powerpoint", matches: OFFICE_OLD },
  pptx: { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", matches: OFFICE_XML },
  txt: { type: "text/plain", matches: PLAIN_TEXT },
  csv: { type: "text/csv", matches: PLAIN_TEXT },
  png: { type: "image/png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  jpg: { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  jpeg: { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  webp: { type: "image/webp", matches: (b) => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
};

export const ATTACHMENT_ACCEPT = Object.keys(TYPES).map((extension) => `.${extension}`).join(",");

/** Keeps the name readable, without paths or characters that could break a download header. */
export function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\p{C}"]/gu, "").trim();
  if (cleaned.length <= 200) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 200 - extension.length) + extension;
}

/** Checks the file's real contents against its extension. The browser's claimed type is ignored. */
export function checkAttachment(name: string, bytes: Buffer): { name: string; type: string } | { error: string } {
  const cleaned = cleanFileName(name);
  const allowed = TYPES[cleaned.split(".").pop()?.toLowerCase() ?? ""];
  if (!cleaned || !cleaned.includes(".") || !allowed) return { error: "Please choose a PDF, Word, Excel, PowerPoint, text, CSV or image file." };
  if (bytes.length === 0) return { error: "That file is empty." };
  if (bytes.length > MAX_ATTACHMENT_BYTES) return { error: "That file is over the 10 MB limit." };
  if (!allowed.matches(bytes)) return { error: "That file's contents don't match its type." };
  return { name: cleaned, type: allowed.type };
}

/** For a Content-Disposition header. Always a download, never opened in the app's own page. */
export const downloadHeader = (name: string) => `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;

export const formatFileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
