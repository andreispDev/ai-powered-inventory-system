"use client";

import { Activity, Pause, Play, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PagerControls } from "@/components/data-table/pagination";
import { useRealtime } from "@/components/providers/realtime-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardTitleIcon } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PAGE_SIZES, pageCount } from "@/lib/pagination";

export type FeedRow = {
  key: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  at: string;
};

type Person = { id: string; name: string; role: string };

const MAX_ROWS = 300;
const PRESENCE_MS = 20_000;
const PEOPLE_PAGE_SIZE = 10;

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function LiveMonitor({ initial }: { initial: FeedRow[] }) {
  const [rows, setRows] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [waiting, setWaiting] = useState<FeedRow[]>([]);
  const [filter, setFilter] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [peoplePage, setPeoplePage] = useState(1);
  const counter = useRef(0);

  const { live } = useRealtime((event) => {
    if (event.type !== "activity") return;
    counter.current += 1;
    const data = event.data as Omit<FeedRow, "key">;
    const row: FeedRow = { ...data, key: `live-${counter.current}` };
    // Held while paused or reading an older page, so rows don't shift under someone reading them.
    if (paused || page > 1) setWaiting((current) => [row, ...current]);
    else setRows((current) => [row, ...current].slice(0, MAX_ROWS));
  });

  useEffect(() => {
    // Times use the viewer's clock, so they only render after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const load = async () => {
      try {
        const response = await fetch("/api/presence", { cache: "no-store" });
        if (response.ok) setPeople((await response.json()).people);
      } catch {
        // Keeps the last list while offline.
      }
    };
    void load();
    const timer = setInterval(load, PRESENCE_MS);
    return () => clearInterval(timer);
  }, []);

  const resume = () => {
    setRows((current) => [...waiting, ...current].slice(0, MAX_ROWS));
    setWaiting([]);
    setPaused(false);
    setPage(1);
  };

  const goToPage = (next: number) => {
    setPage(next);
    if (next === 1 && !paused) {
      setRows((current) => [...waiting, ...current].slice(0, MAX_ROWS));
      setWaiting([]);
    }
  };

  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? rows.filter((row) => `${row.actorName ?? ""} ${row.action} ${row.entityType ?? ""}`.toLowerCase().includes(needle))
    : rows;
  // The list can shrink under a filter or a refresh, so never point past its end.
  const currentPage = Math.min(page, pageCount(visible.length, pageSize));
  const shown = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const peoplePages = pageCount(people?.length ?? 0, PEOPLE_PAGE_SIZE);
  const currentPeoplePage = Math.min(peoplePage, peoplePages);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[3fr_1fr]">
      <Card className="gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CardTitleIcon icon={Activity} />
              Activity
              <Badge variant={live ? "secondary" : "outline"}>{live ? "Live" : "Connecting"}</Badge>
            </span>
            <span className="flex items-center gap-2">
              <Input aria-label="Filter activity" placeholder="Filter…" className="h-8 w-40" value={filter} onChange={(event) => {
                setFilter(event.target.value);
                goToPage(1);
              }} />
              {paused ? (
                <Button variant="outline" size="sm" onClick={resume}>
                  <Play aria-hidden />
                  Resume{waiting.length ? ` (${waiting.length} new)` : ""}
                </Button>
              ) : waiting.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => goToPage(1)}>
                  <Play aria-hidden />
                  {waiting.length} new
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPaused(true)}>
                  <Pause aria-hidden />
                  Pause
                </Button>
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">No activity to show.</p>
          ) : (
            <ul className="divide-y text-sm">
              {shown.map((row) => (
                <li key={row.key} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{row.actorName ?? "System"}</span>{" "}
                    <span className="text-muted-foreground font-mono text-xs">{row.action}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{mounted ? time(row.at) : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <PagerControls
          total={visible.length}
          page={currentPage}
          pageSize={pageSize}
          onPage={goToPage}
          onSize={(size) => {
            setPageSize(size);
            goToPage(1);
          }}
        />
      </Card>
      <Card className="gap-3 overflow-hidden pb-0">
        <CardHeader>
          <CardTitle icon={Users}>
            Online now
            {people && <Badge variant="secondary">{people.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!people ? (
            <p className="text-muted-foreground text-sm">Checking…</p>
          ) : people.length === 0 ? (
            <p className="text-muted-foreground text-sm">No one is online.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {people.slice((currentPeoplePage - 1) * PEOPLE_PAGE_SIZE, currentPeoplePage * PEOPLE_PAGE_SIZE).map((person) => (
                <li key={person.id} className="flex items-center gap-2">
                  <span className="bg-success size-2 shrink-0 rounded-full" aria-hidden />
                  <span className="truncate">{person.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs capitalize">{person.role}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
        <PagerControls total={people?.length ?? 0} page={currentPeoplePage} pageSize={PEOPLE_PAGE_SIZE} onPage={setPeoplePage} />
      </Card>
    </div>
  );
}
