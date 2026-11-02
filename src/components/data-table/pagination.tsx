"use client";

import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PAGE_SIZES, pageCount } from "@/lib/pagination";

/** Table state lives in the URL, so it survives reload, Back and shared links. */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value) next.set(name, value);
      else next.delete(name);
    }
    if (resetPage) next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return { params, set, pending };
}

export function TablePagination({ total, page, pageSize, prefix = "" }: { total: number; page: number; pageSize: number; prefix?: string }) {
  const { set, pending } = useUrlState();
  const pages = pageCount(total, pageSize);
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm">
      <p className="text-muted-foreground tabular-nums" aria-live="polite">
        {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label="Loading" />}
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Rows
          <NativeSelect
            className="w-20"
            value={pageSize}
            onChange={(event) => set({ [`${prefix}size`]: event.target.value, [`${prefix}page`]: null }, false)}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size}>{size}</option>
            ))}
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          size="icon"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => set({ [`${prefix}page`]: String(page - 1) }, false)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={page >= pages}
          aria-label="Next page"
          onClick={() => set({ [`${prefix}page`]: String(page + 1) }, false)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function TableSearch({ placeholder = "Search…" }: { placeholder?: string }) {
  const { params, set } = useUrlState();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);
  const setRef = useRef(set);
  useEffect(() => {
    setRef.current = set;
  });

  useEffect(() => {
    if (value === current) return;
    const timer = setTimeout(() => setRef.current({ q: value || null }), 300);
    return () => clearTimeout(timer);
  }, [value, current]);

  return (
    <div className="relative w-full max-w-xs">
      <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
      <Input
        aria-label={placeholder}
        placeholder={placeholder}
        className="pl-8"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

export function TableFilter({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
}) {
  const { params, set } = useUrlState();
  return (
    <NativeSelect
      aria-label={label}
      className="w-auto max-w-48"
      value={params.get(name) ?? ""}
      onChange={(event) => set({ [name]: event.target.value || null })}
    >
      <option value="">{label}: all</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  );
}
