export type Change = { field: string; before: unknown; after: unknown };

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// Bookkeeping that changes on every write and would only add noise.
const IGNORED = new Set(["version", "updatedAt", "searchTsv", "createdAt"]);

/** The fields an audit entry actually changed. Fields only in "before" are left out unless "after" is missing. */
export function diffValues(before: unknown, after: unknown): Change[] {
  const old = asRecord(before);
  const next = asRecord(after);
  const hasAfter = after !== null && after !== undefined;
  const fields = hasAfter ? Object.keys(next) : Object.keys(old);
  return fields
    .filter((field) => !IGNORED.has(field))
    .map((field) => ({ field, before: old[field], after: next[field] }))
    .filter((change) => JSON.stringify(change.before ?? null) !== JSON.stringify(change.after ?? null));
}
