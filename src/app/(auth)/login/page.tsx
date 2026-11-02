import { Boxes, Building2, Radio, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  { icon: Building2, label: "Each office kept separate" },
  { icon: ScrollText, label: "Every change on record" },
  { icon: Radio, label: "Live updates" },
];

export default function LoginPage() {
  return (
    <div className="mx-auto grid w-full max-w-[84rem] items-center gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[1fr_26rem] lg:gap-16 lg:px-16">
      <section className="auth-rise text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Boxes className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">Inventory</span>
        </div>
        <p className="mt-10 hidden text-xs font-semibold tracking-[0.18em] text-white/80 uppercase sm:block">
          For every office in your organization
        </p>
        <h1 className="mt-3 hidden max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight sm:block lg:text-5xl">
          Every item, every office, one clear record.
        </h1>
        <p className="mt-4 hidden max-w-md text-base text-white/85 sm:block">
          Know what you have, who has it, and what changed, with each office&apos;s data kept to itself.
        </p>
        <ul className="mt-7 hidden flex-wrap gap-2 sm:flex">
          {POINTS.map((point) => (
            <li
              key={point.label}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/25 backdrop-blur"
            >
              <point.icon className="size-3.5" aria-hidden />
              {point.label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Sign in" className="auth-glass auth-rise w-full rounded-3xl p-7 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="mt-1 mb-6 text-sm opacity-85">Access is by invitation only. We&apos;ll email you a one-time code.</p>
        <SignInForm />
      </section>
    </div>
  );
}
