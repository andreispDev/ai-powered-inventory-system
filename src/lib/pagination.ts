export const PAGE_SIZES = [25, 50, 100] as const;

const MAX_OFFSET = 10_000;

export type SearchParams = Record<string, string | string[] | undefined>;

export const param = (params: SearchParams, name: string): string | undefined => {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
};

/** A prefix lets a second table on the page keep its own place. Logs grow far past the usual offset limit. */
export function parsePage(params: SearchParams, { prefix = "", maxOffset = MAX_OFFSET }: { prefix?: string; maxOffset?: number } = {}) {
  const size = Number(param(params, `${prefix}size`));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(size) ? size : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(param(params, `${prefix}page`))) || 1);
  const page = Math.min(requested, Math.floor(maxOffset / pageSize) + 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));
