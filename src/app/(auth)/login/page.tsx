import { Boxes, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="auth-rise w-full max-w-[26rem]">
      <div className="mb-6 flex items-center gap-2.5 lg:hidden">
        <span className="brand-mark text-primary-foreground flex size-9 items-center justify-center rounded-lg">
          <Boxes className="size-5" aria-hidden />
        </span>
        <span className="text-lg font-semibold">Inventory</span>
      </div>
      <section aria-labelledby="sign-in-title" className="bg-card shadow-raised rounded-2xl border p-6 sm:p-8">
        <h1 id="sign-in-title" className="text-2xl font-semibold tracking-tight">
          Sign in to your account
        </h1>
        <p className="text-muted-foreground mt-1.5 mb-6 text-sm">Enter your work email and we&apos;ll send you a sign-in code.</p>
        <SignInForm />
      </section>
      <div className="text-muted-foreground mt-5 space-y-1.5 text-center text-xs">
        <p>Need access? Ask your administrator.</p>
        <p className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          Authorized users only. Sign-ins are logged.
        </p>
      </div>
    </div>
  );
}
