export const MAX_IMAGE_BYTES = 400 * 1024;

const SIGNATURES: { type: string; matches: (bytes: Buffer) => boolean }[] = [
  { type: "image/png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", matches: (b) => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
];

/**
 * Checks the file's real contents, not its name or claimed type.
 * SVG is left out on purpose, because it can carry scripts.
 */
export function parseImage(base64: string): { bytes: Buffer; type: string } | { error: string } {
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) return { error: "That file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { error: "That image is too large. Please choose a smaller one." };
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  if (!match) return { error: "Please choose a PNG, JPEG or WebP image." };
  return { bytes, type: match.type };
}
