"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { createAccount } from "./actions";

const SELECT = "border-input bg-background h-9 w-full rounded-md border px-2 text-sm";

export function AccountForm({
  canCreateAdmin,
  offices,
  fixedOfficeId,
  defaultRole = "user",
  onDone,
}: {
  canCreateAdmin: boolean;
  /** Developers choose an office. Office admins don't see this. */
  offices?: readonly { id: string; name: string }[];
  fixedOfficeId?: string;
  defaultRole?: "admin" | "user";
  onDone?: "stay" | "open";
}) {
  const router = useRouter();
  const { submit, state } = useSubmit(createAccount);
  const [values, setValues] = useState({ name: "", email: "", role: defaultRole, officeId: fixedOfficeId ?? "" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ ...values, officeId: values.officeId || undefined });
    if (!result?.ok) return;
    toast.success("Account created. They can now sign in with an emailed code.");
    if (onDone === "stay") {
      setValues({ ...values, name: "", email: "" });
      router.refresh();
    } else {
      router.push(`/accounts/${result.data.id}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField id="name" label="Full name" required errors={state.fieldErrors.name}>
        <Input
          id="name"
          required
          value={values.name}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
      </FormField>
      <FormField id="email" label="Email" required help="They sign in with a code sent here." errors={state.fieldErrors.email}>
        <Input
          id="email"
          type="email"
          required
          value={values.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
      </FormField>
      {canCreateAdmin && (
        <FormField id="role" label="Role" errors={state.fieldErrors.role}>
          <select
            id="role"
            className={SELECT}
            value={values.role}
            onChange={(event) => setValues({ ...values, role: event.target.value as "admin" | "user" })}
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </FormField>
      )}
      {offices && !fixedOfficeId && (
        <FormField id="officeId" label="Office" required errors={state.fieldErrors.officeId}>
          <select
            id="officeId"
            required
            className={SELECT}
            value={values.officeId}
            onChange={(event) => setValues({ ...values, officeId: event.target.value })}
          >
            <option value="">Choose an office</option>
            {offices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormError state={state} />
      <SubmitButton state={state}>Create account</SubmitButton>
    </form>
  );
}
