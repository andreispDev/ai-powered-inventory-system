import { Boxes } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Card className="shadow-raised w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <span className="brand-mark text-primary-foreground shadow-card mx-auto mb-2 flex size-10 items-center justify-center rounded-lg">
          <Boxes className="size-5" aria-hidden />
        </span>
        <CardTitle className="text-xl">Sign in to Inventory</CardTitle>
        <CardDescription>Access is by invitation only.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm />
      </CardContent>
    </Card>
  );
}
