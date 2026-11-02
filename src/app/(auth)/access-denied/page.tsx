import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <div className="auth-rise w-full max-w-[26rem]">
      <section className="bg-card shadow-raised rounded-2xl border p-6 text-center sm:p-8">
        <ShieldX className="text-destructive mx-auto mb-3 size-8" aria-hidden />
        <h1 className="text-xl font-semibold">You can&apos;t sign in right now</h1>
        <p className="text-muted-foreground mt-2 mb-6 text-sm">
          Your session has ended or your account doesn&apos;t have access. If this keeps happening, ask your administrator.
        </p>
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </section>
    </div>
  );
}
