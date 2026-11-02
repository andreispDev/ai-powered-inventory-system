"use client";

import {
  AlignLeft,
  Banknote,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Hash,
  Link2,
  ListChecks,
  ListFilter,
  type LucideIcon,
  Mail,
  Type,
  User,
} from "lucide-react";
import { FormField } from "@/components/forms/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isNumeric, type FieldDef, type FieldType } from "@/modules/categories/field-schema";

const ICONS: Record<FieldType, LucideIcon> = {
  text: Type,
  long_text: AlignLeft,
  integer: Hash,
  decimal: Hash,
  currency: Banknote,
  date: CalendarDays,
  datetime: CalendarClock,
  boolean: CheckSquare,
  select: ListFilter,
  multi_select: ListChecks,
  url: Link2,
  email: Mail,
  person: User,
};

/** Renders any custom column, so every form comes from the same definitions. */
export function DynamicField({
  field,
  value,
  onChange,
  errors,
  people,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  errors?: string[];
  people: readonly { id: string; name: string }[];
}) {
  const id = `attr-${field.key}`;
  const { type, config } = field;
  const label = config.unit ? `${field.label} (${config.unit})` : field.label;

  const control = () => {
    switch (type) {
      case "long_text":
        return <Textarea id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
      case "boolean":
        return (
          <div className="flex h-9 items-center">
            <Checkbox id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
          </div>
        );
      case "select":
        return (
          <NativeSelect id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose…</option>
            {config.options?.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </NativeSelect>
        );
      case "multi_select": {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div id={id} className="flex flex-wrap gap-3 py-1">
            {config.options?.map((option) => (
              <label key={option} className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) =>
                    onChange(checked === true ? [...selected, option] : selected.filter((v) => v !== option))
                  }
                />
                {option}
              </label>
            ))}
          </div>
        );
      }
      case "person":
        return (
          <NativeSelect id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            <option value="">Choose…</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        );
      default: {
        const inputType = isNumeric(type)
          ? "number"
          : type === "date"
            ? "date"
            : type === "datetime"
              ? "datetime-local"
              : type === "url"
                ? "url"
                : type === "email"
                  ? "email"
                  : "text";
        return (
          <Input
            id={id}
            type={inputType}
            step={type === "integer" ? 1 : "any"}
            value={String(value ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(isNumeric(type) && raw !== "" ? Number(raw) : raw);
            }}
          />
        );
      }
    }
  };

  return (
    <FormField id={id} icon={ICONS[type]} label={label} required={config.required} help={config.help} errors={errors}>
      {control()}
    </FormField>
  );
}
