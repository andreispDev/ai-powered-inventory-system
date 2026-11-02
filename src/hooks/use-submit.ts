"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection } from "@/components/connectivity/connectivity";
import type { ActionResult } from "@/server/guard/errors";

export type SubmitState = {
  pending: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  offline: boolean;
};

/**
 * Runs a guarded action from a form. One key is kept until a submission succeeds,
 * so retrying after a dropped connection can't apply a change twice.
 */
export function useSubmit<I, R>(action: (input: I, retryKey?: string) => Promise<ActionResult<R>>) {
  const connection = useConnection();
  const key = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const submit = useCallback(
    async (input: I): Promise<ActionResult<R> | null> => {
      setPending(true);
      setError(null);
      setFieldErrors({});
      key.current ??= crypto.randomUUID();
      try {
        const result = await action(input, key.current);
        if (result.ok) {
          key.current = null;
          return result;
        }
        setFieldErrors(result.fieldErrors ?? {});
        setError(
          result.code === "RATE_LIMITED"
            ? `Too many requests. Try again in ${result.retryAfterSeconds ?? 60}s.`
            : result.message,
        );
        return result;
      } catch {
        setError("Couldn't reach the server. Your entries are still here, so please try again.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [action],
  );

  const state: SubmitState = { pending, error, fieldErrors, offline: connection !== "online" };
  return { submit, state };
}
