"use client";

import { AlignLeft, Building2, Clock, Heading, Send, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Confirm } from "@/components/feedback/confirm";
import { FormError, FormField, SubmitButton } from "@/components/forms/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmit } from "@/hooks/use-submit";
import { createAnnouncement } from "./actions";

type Audience = "all" | "offices" | "role";
type Role = "developer" | "admin" | "user";

export function AnnouncementForm({
  global,
  offices,
  officeName,
}: {
  global: boolean;
  offices: readonly { id: string; name: string }[];
  officeName: string | null;
}) {
  const router = useRouter();
  const { submit, state } = useSubmit(createAnnouncement);
  const form = useRef<HTMLFormElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [audience, setAudience] = useState<Audience>("all");
  const [officeIds, setOfficeIds] = useState<string[]>([]);
  const [role, setRole] = useState<Role>("user");
  const [when, setWhen] = useState("");

  const audienceLabel = !global
    ? `everyone in ${officeName}`
    : audience === "all"
      ? "everyone in the organization"
      : audience === "role"
        ? `every ${role}`
        : `${officeIds.length} chosen ${officeIds.length === 1 ? "office" : "offices"}`;

  async function send() {
    const result = await submit({
      title,
      body,
      urgent,
      audienceType: global ? audience : "offices",
      audienceOfficeIds: officeIds,
      audienceRole: role,
      scheduledAt: when ? new Date(when).toISOString() : "",
    });
    if (!result?.ok) return;
    toast.success(when ? "Announcement scheduled." : "Announcement is being sent.");
    setTitle("");
    setBody("");
    setUrgent(false);
    setWhen("");
    router.refresh();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setConfirming(true);
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-4">
      <Confirm
        open={confirming}
        onOpenChange={setConfirming}
        title={when ? "Schedule this announcement?" : "Send this announcement?"}
        description={`It goes to ${audienceLabel}${urgent ? " as an urgent banner they must acknowledge" : ""}. It can't be recalled once sent.`}
        confirmLabel={when ? "Schedule" : "Send"}
        onConfirm={send}
      />
      <FormField id="title" icon={Heading} label="Title" required errors={state.fieldErrors.title}>
        <Input id="title" required value={title} onChange={(event) => setTitle(event.target.value)} />
      </FormField>
      <FormField id="body" icon={AlignLeft} label="Message" required errors={state.fieldErrors.body}>
        <Textarea id="body" required rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      </FormField>
      {global && (
        <FormField id="audience" icon={Send} label="Send to">
          <NativeSelect id="audience" value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
            <option value="all">Everyone</option>
            <option value="offices">Chosen offices</option>
            <option value="role">A role</option>
          </NativeSelect>
        </FormField>
      )}
      {global && audience === "offices" && (
        <FormField id="offices" icon={Building2} label="Offices" errors={state.fieldErrors.audienceOfficeIds}>
          <div id="offices" className="space-y-1.5 rounded-lg border p-2.5">
            {offices.map((office) => (
              <label key={office.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={officeIds.includes(office.id)}
                  onCheckedChange={(checked) =>
                    setOfficeIds(checked === true ? [...officeIds, office.id] : officeIds.filter((id) => id !== office.id))
                  }
                />
                {office.name}
              </label>
            ))}
          </div>
        </FormField>
      )}
      {global && audience === "role" && (
        <FormField id="role" icon={Shield} label="Role" errors={state.fieldErrors.audienceRole}>
          <NativeSelect id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="developer">Developers</option>
            <option value="admin">Admins</option>
            <option value="user">Users</option>
          </NativeSelect>
        </FormField>
      )}
      <FormField id="when" icon={Clock} label="Send later" help="Leave empty to send now." errors={state.fieldErrors.scheduledAt}>
        <Input id="when" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={urgent} onCheckedChange={(checked) => setUrgent(checked === true)} />
        Urgent: show a banner until people acknowledge it
      </label>
      <FormError state={state} />
      <div className="flex justify-end border-t pt-4">
        <SubmitButton state={state}>{when ? "Schedule" : "Send"}</SubmitButton>
      </div>
    </form>
  );
}
