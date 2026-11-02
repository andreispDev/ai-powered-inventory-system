"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Permission } from "@/server/authz/catalog";
import { navFor } from "./nav";

type Result = { group: string; label: string; detail: string | null; href: string };

const SEARCH_DELAY_MS = 200;

/** Ctrl/Cmd+K: go to any page you can use, or find a record. */
export function CommandPalette({ permissions }: { permissions: readonly Permission[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" });
        if (response.ok) setResults((await response.json()).results);
      } catch {
        // Aborted or offline. The page list below still works.
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const needle = query.trim().toLowerCase();
  const shownResults = needle.length < 2 ? [] : results;
  const pages = navFor(permissions)
    .flatMap((group) => group.items)
    .filter((item) => item.href && item.label.toLowerCase().includes(needle));
  const groups = [...new Set(shownResults.map((result) => result.group))];

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  };

  return (
    <>
      <Button variant="outline" className="text-muted-foreground hidden w-56 justify-start gap-2 sm:inline-flex" onClick={() => setOpen(true)}>
        <Search aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="bg-muted rounded px-1.5 font-mono text-[0.625rem]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => setOpen(true)}>
        <Search aria-hidden />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Find a page or record">
        <Command shouldFilter={false}>
        <CommandInput placeholder="Search pages, items, people…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group} heading={group}>
              {shownResults
                .filter((result) => result.group === group)
                .map((result) => (
                  <CommandItem key={result.href} value={result.href} onSelect={() => go(result.href)}>
                    <span className="truncate">{result.label}</span>
                    {result.detail && <span className="text-muted-foreground ml-auto truncate text-xs">{result.detail}</span>}
                  </CommandItem>
                ))}
            </CommandGroup>
          ))}
          {pages.length > 0 && (
            <CommandGroup heading="Pages">
              {pages.map((page) => (
                <CommandItem key={page.href} value={page.href} onSelect={() => go(page.href!)}>
                  <page.icon aria-hidden />
                  {page.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
