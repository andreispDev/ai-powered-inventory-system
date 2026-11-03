import { Bot, BrainCircuit, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { AgentArt } from "./agent-art";
import { ThemeToggle } from "./theme-toggle";

const POINTS = [
  { icon: BrainCircuit, label: "Predicts shortages before they happen" },
  { icon: Bot, label: "An assistant that answers in plain language" },
  { icon: ShieldCheck, label: "Each office's data stays private" },
];

/** Artwork on one side, and the form on its own gradient where it's easy to read. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-[minmax(0,1.15fr)_minmax(28rem,1fr)]">
      <aside className="relative isolate hidden overflow-hidden bg-[#030712] text-white lg:flex lg:flex-col lg:justify-end lg:p-12">
        <AgentArt />
        <p className="text-xs font-semibold tracking-[0.2em] text-cyan-300/90 uppercase">AI-powered inventory platform</p>
        <p className="mt-3 max-w-lg text-4xl leading-[1.15] font-semibold tracking-tight">Inventory intelligence that works alongside your team.</p>
        <ul className="mt-8 space-y-3 text-sm text-white/85">
          {POINTS.map((point) => (
            <li key={point.label} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-cyan-300/30">
                <point.icon className="size-4 text-cyan-200" aria-hidden />
              </span>
              {point.label}
            </li>
          ))}
        </ul>
      </aside>
      <div className="auth-form-bg relative flex min-w-0 items-center justify-center px-6 py-14 sm:px-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        {children}
      </div>
    </main>
  );
}
