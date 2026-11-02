"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useUrlState } from "@/components/data-table/pagination";
import { Confirm } from "@/components/feedback/confirm";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSubmit } from "@/hooks/use-submit";
import { clearGrant, setGrant } from "./actions";

export type MatrixRow = {
  permission: string;
  roleDefault: boolean;
  effective: boolean | null;
  why: string;
  rule: { effect: "allow" | "deny"; reason: string; expiresAt: string | null; expired: boolean } | null;
};

export function SubjectPicker({ options, value }: { options: { value: string; label: string; group: string }[]; value: string }) {
  const { set } = useUrlState();
  const groups = [...new Set(options.map((option) => option.group))];
  return (
    <div className="max-w-md">
      <label htmlFor="subject" className="mb-1.5 block text-sm font-medium">
        Office or person
      </label>
      <NativeSelect id="subject" value={value} onChange={(event) => set({ subject: event.target.value || null })}>
        <option value="">Choose…</option>
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {options
              .filter((option) => option.group === group)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </optgroup>
        ))}
      </NativeSelect>
    </div>
  );
}

function GrantDialog({
  permission,
  effect,
  subjectType,
  subjectId,
  onClose,
}: {
  permission: string;
  effect: "allow" | "deny";
  subjectType: "user" | "office";
  subjectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { submit, state } = useSubmit(setGrant);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = await submit({ subjectType, subjectId, permission, effect, reason, expiresAt });
    if (!result?.ok) return;
    toast.success("Rule saved. It applies on their next request.");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {effect === "allow" ? "Allow" : "Deny"} <span className="font-mono text-sm">{permission}</span>
          </DialogTitle>
          <DialogDescription>
            This applies to {subjectType === "user" ? "this person" : "everyone in this office"} on their next request, and they&apos;re notified.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField id="grant-reason" label="Reason" required errors={state.fieldErrors.reason}>
            <Input id="grant-reason" required value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          <FormField id="grant-expires" label="Expires on" help="Optional. Leave empty to keep it until changed." errors={state.fieldErrors.expiresAt}>
            <Input id="grant-expires" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
          </FormField>
          <FormError state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton state={state}>{effect === "allow" ? "Allow" : "Deny"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PermissionMatrix({
  rows,
  subjectType,
  subjectId,
  showEffective,
}: {
  rows: MatrixRow[];
  subjectType: "user" | "office";
  subjectId: string;
  showEffective: boolean;
}) {
  const router = useRouter();
  const clear = useSubmit(clearGrant);
  const [granting, setGranting] = useState<{ permission: string; effect: "allow" | "deny" } | null>(null);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {granting && <GrantDialog {...granting} subjectType={subjectType} subjectId={subjectId} onClose={() => setGranting(null)} />}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Permission</TableHead>
            {showEffective && <TableHead>Access now</TableHead>}
            <TableHead>Why</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead className="text-right">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.permission}>
              <TableCell className="font-mono text-xs">{row.permission}</TableCell>
              {showEffective && (
                <TableCell>
                  <Badge variant={row.effective ? "secondary" : "outline"}>{row.effective ? "Allowed" : "Not allowed"}</Badge>
                </TableCell>
              )}
              <TableCell className="text-muted-foreground max-w-64 truncate text-xs">{row.why}</TableCell>
              <TableCell className="text-xs">
                {row.rule ? (
                  <span className="capitalize">
                    {row.rule.effect}
                    {row.rule.expired ? " (expired)" : row.rule.expiresAt ? ` until ${new Date(row.rule.expiresAt).toISOString().slice(0, 10)}` : ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Default ({row.roleDefault ? "allowed" : "not allowed"})</span>
                )}
              </TableCell>
              <TableCell className="space-x-1 text-right whitespace-nowrap">
                <Button variant="ghost" size="sm" onClick={() => setGranting({ permission: row.permission, effect: "allow" })}>
                  Allow
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setGranting({ permission: row.permission, effect: "deny" })}>
                  Deny
                </Button>
                {row.rule && (
                  <Confirm
                    title="Remove this rule?"
                    description={`${row.permission} goes back to the default. Affected people are notified.`}
                    confirmLabel="Remove rule"
                    destructive
                    onConfirm={async () => {
                      const result = await clear.submit({ subjectType, subjectId, permission: row.permission });
                      if (result?.ok) {
                        toast.success("Rule removed.");
                        router.refresh();
                      } else if (result) toast.error(result.message);
                    }}
                  >
                    <Button variant="ghost" size="sm">
                      Clear
                    </Button>
                  </Confirm>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
