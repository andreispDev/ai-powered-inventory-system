export const PAGE_SIZES = [25, 50, 100] as const;

const MAX_OFFSET = 10_000;

export type SearchParams = Record<string, string | string[] | undefined>;

export const param = (params: SearchParams, name: string): string | undefined => {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
};

export function parsePage(params: SearchParams) {
  const size = Number(param(params, "size"));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(size) ? size : PAGE_SIZES[0];
  const requested = Math.max(1, Math.floor(Number(param(params, "page"))) || 1);
  const page = Math.min(requested, Math.floor(MAX_OFFSET / pageSize) + 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export const pageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize));
