import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A real browser select, styled to match inputs. Works well with phones and screen readers. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        className="border-input bg-background shadow-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full appearance-none truncate rounded-lg border pr-8 pl-2.5 text-sm transition-colors outline-none focus-visible:ring-3 disabled:opacity-60"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}
