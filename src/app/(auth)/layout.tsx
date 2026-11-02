import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-svh overflow-hidden bg-[#0b1630]">
      <Image
        src="/images/login-building.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[center_45%]"
      />
      <div aria-hidden className="auth-scrim absolute inset-0 -z-10" />
      <div aria-hidden className="auth-pattern absolute inset-0 -z-10" />
      {children}
    </main>
  );
}
