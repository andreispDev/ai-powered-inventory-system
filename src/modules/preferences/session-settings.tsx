"use client";

import { Clock, TimerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { MAX_IDLE_MINUTES, MIN_IDLE_MINUTES } from "@/server/auth/idle";
import { setIdleMinutes } from "./session-actions";

export function SessionSettings({ minutes }: { minutes: number }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setIdleMinutes);
  const [value, setValue] = useState(String(minutes));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ minutes: Number(value) });
    if (result?.ok) {
      toast.success("Idle sign-out time saved.");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle icon={TimerOff}>Idle sign-out</CardTitle>
        <CardDescription>How long any account in any office can sit idle before it&apos;s signed out. People get a 30-second warning first.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField id="idle-minutes" icon={Clock} label="Minutes" required help={`From ${MIN_IDLE_MINUTES} to ${MAX_IDLE_MINUTES} (8 hours). Shorter is safer on shared computers.`} errors={state.fieldErrors.minutes}>
            <Input id="idle-minutes" type="number" required min={MIN_IDLE_MINUTES} max={MAX_IDLE_MINUTES} step={1} value={value} onChange={(event) => setValue(event.target.value)} />
          </FormField>
          <FormError state={state} />
          <div className="flex justify-end border-t pt-4">
            <SubmitButton state={state}>Save</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
