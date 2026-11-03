import { Boxes, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="auth-rise w-full max-w-[24rem]">
      <span className="brand-mark text-primary-foreground shadow-raised flex size-12 items-center justify-center rounded-xl">
        <Boxes className="size-6" aria-hidden />
      </span>
      <p className="text-primary mt-8 text-xs font-semibold tracking-[0.18em] uppercase">AI-powered inventory</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-muted-foreground mt-2 mb-8 text-sm">Sign in with your work email. We&apos;ll send you a one-time code.</p>
      <SignInForm />
      <div className="text-muted-foreground mt-10 space-y-1.5 text-xs">
        <p>Need access? Ask your administrator.</p>
        <p className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          Authorized users only. Sign-ins are logged.
        </p>
      </div>
    </div>
  );
}
