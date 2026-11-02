"use client";

import { Banknote, CalendarDays, MapPin, Truck, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSubmit } from "@/hooks/use-submit";
import { setFieldDisabled } from "./actions";
import { OPTIONAL_ITEM_FIELDS, type OptionalItemField } from "./field-schema";

const ICONS: Record<OptionalItemField, LucideIcon> = {
  location: MapPin,
  supplier: Truck,
  unitCost: Banknote,
  purchaseDate: CalendarDays,
};

export function StandardFields({ categoryId, disabled, canEdit }: { categoryId: string; disabled: readonly string[]; canEdit: boolean }) {
  const router = useRouter();
  const { submit, state } = useSubmit(setFieldDisabled);
  const [pending, setPending] = useState<{ field: OptionalItemField; label: string; disable: boolean } | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Standard fields</CardTitle>
        <CardDescription>Turn off the ones this category doesn&apos;t need. Existing values are kept.</CardDescription>
      </CardHeader>
      <CardContent>
        {pending && (
          <Confirm
            open
            onOpenChange={(open) => !open && setPending(null)}
            title={`${pending.disable ? "Disable" : "Enable"} ${pending.label}?`}
            description={
              pending.disable
                ? "It's hidden from this category's forms and pages. Values already saved are kept."
                : "It comes back on this category's forms and pages, with any values saved earlier."
            }
            confirmLabel={pending.disable ? "Disable" : "Enable"}
            destructive={pending.disable}
            onConfirm={async () => {
              const result = await submit({ id: categoryId, field: pending.field, disabled: pending.disable });
              if (result?.ok) {
                toast.success(`${pending.label} ${pending.disable ? "disabled" : "enabled"}.`);
                router.refresh();
              } else if (result) toast.error(result.message);
              setPending(null);
            }}
          />
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {OPTIONAL_ITEM_FIELDS.map(({ id, label }) => {
            const Icon = ICONS[id];
            const on = !disabled.includes(id);
            return (
              <li key={id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <label htmlFor={`std-${id}`} className="min-w-0 flex-1 truncate text-sm">
                  {label}
                </label>
                <Switch
                  id={`std-${id}`}
                  checked={on}
                  disabled={!canEdit || state.pending || state.offline}
                  onCheckedChange={(checked) => setPending({ field: id, label, disable: !checked })}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
