import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">{children}</main>;
}
