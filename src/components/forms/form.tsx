"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { SubmitState } from "@/hooks/use-submit";

export function FormField({
  id,
  label,
  required,
  help,
  errors,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  errors?: string[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
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
        <p key={message} id={`${id}-error`} className="text-destructive text-xs">
          {message}
        </p>
      ))}
    </div>
  );
}

export function FormError({ state }: { state: SubmitState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
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
