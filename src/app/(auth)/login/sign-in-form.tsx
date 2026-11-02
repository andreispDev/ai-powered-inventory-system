"use client";

import { KeyRound, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestSignInCode, signInWithCode } from "@/lib/auth-client";

const RESEND_SECONDS = 60;

const noSubscribe = () => () => {};
const wasIdle = () => new URLSearchParams(window.location.search).get("reason") === "idle";

export function SignInForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const idle = useSyncExternalStore(noSubscribe, wasIdle, () => false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function sendCode() {
    setPending(true);
    setError(null);
    const result = await requestSignInCode(email).catch(() => null);
    setPending(false);
    if (!result || result.error) {
      setError(
        result?.error?.status === 429
          ? "Too many codes requested. Please wait a while and try again."
          : "Couldn't send a code. Please check your connection and try again.",
      );
      return;
    }
    setStep("code");
    setCode("");
    setWait(RESEND_SECONDS);
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    await sendCode();
  }

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signInWithCode(email, code).catch(() => null);
    if (!result || result.error) {
      setPending(false);
      setCode("");
      setError(
        result?.error?.status === 403
          ? "Too many wrong tries. Please request a new code."
          : "That code didn't work. Check it, or request a new one.",
      );
      return;
    }
    router.replace("/dashboard");
  }

  if (step === "email") {
    return (
      <form onSubmit={submitEmail} className="space-y-4">
        {idle && (
          <p role="status" className="rounded-lg bg-white/15 px-3 py-2 text-sm">
            You were signed out after 5 minutes of inactivity.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">
            <Mail className="size-3.5" aria-hidden />
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@gmail.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-white/30 bg-black/30 px-3 py-2 text-sm text-white">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Email me a code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="space-y-4">
      <p className="text-sm opacity-90">
        If <span className="text-foreground font-medium break-all">{email}</span> has an account, a 6-digit code is on
        its way. It expires in 5 minutes.
      </p>
      <div className="space-y-2">
        <Label htmlFor="code">
          <KeyRound className="size-3.5" aria-hidden />
          Sign-in code
        </Label>
        <Input
          id="code"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          className="text-center font-mono tracking-[0.4em]"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-white/30 bg-black/30 px-3 py-2 text-sm text-white">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending || code.length !== 6}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
      <div className="flex justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setStep("email");
            setError(null);
          }}
        >
          Change email
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={wait > 0 || pending} onClick={sendCode}>
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </Button>
      </div>
    </form>
  );
}
