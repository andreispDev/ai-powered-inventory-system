"use client";

import { CircleAlert, Loader2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SubmitState } from "@/hooks/use-submit";
import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  icon: Icon,
  required,
  help,
  errors,
  children,
}: {
  id: string;
  label: string;
  icon?: LucideIcon;
  required?: boolean;
  help?: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-1.5",
        errors?.length && "[&_input]:border-destructive [&_select]:border-destructive [&_textarea]:border-destructive",
      )}
    >
      <Label htmlFor={id}>
        {Icon && <Icon className="text-muted-foreground size-3.5" aria-hidden />}
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        )}
      </Label>
      {children}
      {help && <p className="text-muted-foreground text-xs">{help}</p>}
      {errors?.map((message) => (
        <p key={message} id={`${id}-error`} className="text-destructive flex items-center gap-1 text-xs">
          <CircleAlert className="size-3 shrink-0" aria-hidden />
          {message}
        </p>
      ))}
    </div>
  );
}

export function FormError({ state }: { state: SubmitState }) {
  if (!state.error) return null;
  return (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      {state.error}
    </p>
  );
}

export function SubmitButton({
  state,
  children,
  variant,
}: {
  state: SubmitState;
  children: ReactNode;
  variant?: "default" | "destructive" | "outline";
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={state.pending || state.offline}
      title={state.offline ? "You're offline. Changes are paused." : undefined}
    >
      {state.pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Save on the right and Cancel beside it, the same on every form. */
export function FormActions({
  state,
  submitLabel,
  showCancel = true,
}: {
  state: SubmitState;
  submitLabel: string;
  showCancel?: boolean;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
      {showCancel && (
        <Button type="button" variant="ghost" disabled={state.pending} onClick={() => router.back()}>
          Cancel
        </Button>
      )}
      <SubmitButton state={state}>{submitLabel}</SubmitButton>
    </div>
  );
}
