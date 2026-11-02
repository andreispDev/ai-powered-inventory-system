"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth-client";

export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function start() {
    setPending(true);
    setFailed(false);
    const { error } = await signInWithGoogle().catch(() => ({ error: true }));
    if (error) {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={start} disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        Continue with Google
      </Button>
      {failed && (
        <p role="alert" className="text-destructive text-center text-sm">
          Couldn&apos;t start sign-in. Please try again.
        </p>
      )}
    </div>
  );
}
