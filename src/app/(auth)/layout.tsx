import { Boxes, Building2, MessageSquare, Sparkles } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

const POINTS = [
  { icon: Sparkles, label: "Forecasts that flag shortages early" },
  { icon: MessageSquare, label: "Answers in plain language" },
  { icon: Building2, label: "Each office's data kept private" },
];

/** The photo stays on its own panel, and the form sits on a plain surface where it's easy to read. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background grid min-h-svh lg:grid-cols-[minmax(0,1.15fr)_minmax(28rem,1fr)]">
      <aside className="relative isolate hidden overflow-hidden bg-[#0b1630] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Image src="/images/login-building.webp" alt="" fill priority sizes="55vw" className="-z-20 object-cover object-[center_45%]" />
        <div aria-hidden className="auth-scrim absolute inset-0 -z-10" />
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30">
            <Boxes className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">Inventory</span>
        </div>
        <div>
          <p className="max-w-lg text-4xl leading-[1.15] font-semibold tracking-tight">Every office&apos;s inventory, in one secure place.</p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {POINTS.map((point) => (
              <li key={point.label} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
                  <point.icon className="size-4" aria-hidden />
                </span>
                {point.label}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex min-w-0 items-center justify-center px-5 py-10 sm:px-10">{children}</div>
    </main>
  );
}
