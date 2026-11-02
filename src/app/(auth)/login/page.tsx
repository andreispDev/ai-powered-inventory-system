import { Boxes, Building2, MessageSquare, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  { icon: Sparkles, label: "AI forecasts" },
  { icon: MessageSquare, label: "Ask in plain language" },
  { icon: Building2, label: "Private to each office" },
];

export default function LoginPage() {
  return (
    <div className="mx-auto grid w-full max-w-md content-center items-center gap-6 px-6 py-10 lg:max-w-[84rem] lg:grid-cols-[1fr_26rem] lg:gap-16 lg:px-16">
      <section className="auth-rise text-white">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30 backdrop-blur">
            <Boxes className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">Inventory</span>
        </div>
        <p className="mt-10 hidden text-xs font-semibold tracking-[0.18em] text-white/80 uppercase lg:block">
          AI-powered inventory management
        </p>
        <h1 className="mt-3 hidden max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight lg:block lg:text-5xl">
          Smarter inventory, so your team can focus on what matters.
        </h1>
        <p className="mt-4 hidden max-w-md text-base text-white/85 lg:block">
          Bring every office&apos;s stock together, spot shortages before they happen, and get answers just by asking.
        </p>
        <ul className="mt-7 hidden flex-wrap gap-2 lg:flex">
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

      <section aria-label="Sign in" className="auth-glass auth-rise w-full lg:rounded-3xl lg:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
        <p className="mt-1 mb-6 text-sm">Welcome back. Enter your email and we&apos;ll send you a sign-in code.</p>
        <SignInForm />
        <p className="mt-5 text-center text-xs">Need access? Ask your administrator.</p>
      </section>
    </div>
  );
}
