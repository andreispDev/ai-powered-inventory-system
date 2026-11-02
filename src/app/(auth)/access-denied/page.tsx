import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Access denied" };

export default function AccessDeniedPage() {
  return (
    <Card className="w-full max-w-sm text-center">
      <CardHeader>
        <ShieldX className="text-destructive mx-auto mb-2 size-8" aria-hidden />
        <CardTitle className="text-xl">You can&apos;t sign in right now</CardTitle>
        <CardDescription>
          Your session has ended or your account doesn&apos;t have access. If this keeps happening, ask your administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
