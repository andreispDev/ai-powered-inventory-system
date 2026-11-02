"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

const greetingNow = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

const dateNow = () => new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/** The greeting uses the viewer's clock, so the server renders a neutral one. */
export function WelcomeBanner({
  name,
  subtitle,
  badge,
  actions,
  media,
}: {
  name: string;
  subtitle: string;
  badge: string;
  actions?: { label: string; href: string }[];
  media?: ReactNode;
}) {
  const greeting = useSyncExternalStore(noSubscribe, greetingNow, () => "Welcome");
  const today = useSyncExternalStore(noSubscribe, dateNow, () => "");

  return (
    <section className="welcome-banner welcome-hero text-primary-foreground shadow-raised relative isolate overflow-hidden rounded-2xl px-6 py-6 sm:px-8 sm:py-7">
      <div aria-hidden className="welcome-scrim absolute inset-0 -z-10" />
      <div aria-hidden className="welcome-rings absolute inset-0 -z-10" />
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          {media}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium opacity-90">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-1">
                <Sparkles className="size-3" aria-hidden />
                {badge}
              </span>
              <span suppressHydrationWarning>{today}</span>
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight break-words sm:text-3xl" suppressHydrationWarning>
              {greeting}, {name}
            </h1>
            <p className="mt-1 text-sm opacity-90">{subtitle}</p>
          </div>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="focus-visible:ring-primary-foreground rounded-lg bg-black/15 px-3 py-2 text-sm font-medium transition-colors duration-[var(--motion-fast)] outline-none hover:bg-black/25 focus-visible:ring-2"
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
