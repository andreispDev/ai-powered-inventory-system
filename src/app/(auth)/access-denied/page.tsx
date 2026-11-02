import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <div className="flex w-full items-center justify-center p-5">
      <section className="auth-glass auth-rise w-full max-w-md text-center lg:rounded-3xl lg:p-8">
        <ShieldX className="mx-auto mb-3 size-8" aria-hidden />
        <h1 className="text-xl font-semibold">You can&apos;t sign in right now</h1>
        <p className="mt-2 mb-6 text-sm opacity-85">
          Your session has ended or your account doesn&apos;t have access. If this keeps happening, ask your administrator.
        </p>
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </section>
    </div>
  );
}
