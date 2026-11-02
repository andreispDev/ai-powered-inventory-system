"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { FormActions, FormError, FormField } from "@/components/forms/form";
import { Input } from "@/components/ui/input";
import { useSubmit } from "@/hooks/use-submit";
import { createOffice, updateOffice } from "./actions";

type Values = { id?: string; code: string; name: string; address: string | null; contactEmail: string | null };

export function OfficeForm({ office }: { office?: Values }) {
  const router = useRouter();
  const [values, setValues] = useState({
    code: office?.code ?? "",
    name: office?.name ?? "",
    address: office?.address ?? "",
    contactEmail: office?.contactEmail ?? "",
  });
  const create = useSubmit(createOffice);
  const update = useSubmit(updateOffice);
  const { state } = office ? update : create;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = office?.id ? await update.submit({ ...values, id: office.id }) : await create.submit(values);
    if (!result?.ok) return;
    toast.success(office ? "Office saved." : "Office created.");
    if (!office) router.push(`/console/offices/${result.data.id}`);
  }

  const bind = (name: keyof typeof values) => ({
    id: `office-${name}`,
    value: values[name],
    onChange: (event: { target: { value: string } }) => setValues({ ...values, [name]: event.target.value }),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <FormField id="office-code" label="Code" required errors={state.fieldErrors.code}>
          <Input {...bind("code")} required className="uppercase" />
        </FormField>
        <FormField id="office-name" label="Name" required errors={state.fieldErrors.name}>
          <Input {...bind("name")} required />
        </FormField>
      </div>
      <FormField id="office-address" label="Address" errors={state.fieldErrors.address}>
        <Input {...bind("address")} />
      </FormField>
      <FormField id="office-contactEmail" label="Contact email" errors={state.fieldErrors.contactEmail}>
        <Input {...bind("contactEmail")} type="email" />
      </FormField>
      <FormError state={state} />
      <FormActions state={state} submitLabel={office ? "Save office" : "Create office"} showCancel={!office} />
    </form>
  );
}
