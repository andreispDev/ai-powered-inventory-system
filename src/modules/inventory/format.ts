import { deploymentOf, type Deployment, type FieldDef } from "@/modules/categories/field-schema";
import { ITEM_STATUSES } from "./schemas";

const DAY = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function formatDeployment(deployment: Deployment): string {
  if (deployment.state === "office") return "Office only";
  const by = deployment.byName ? ` by ${deployment.byName}` : "";
  return `Deployed${by}${deployment.at ? ` on ${DAY.format(new Date(deployment.at))}` : ""}`;
}

export function formatAttribute(value: unknown, field: FieldDef, people: Readonly<Record<string, string>>): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "deployment") {
    const deployment = deploymentOf(value);
    return deployment ? formatDeployment(deployment) : "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (field.type === "person") return people[String(value)] ?? "—";
  return field.config.unit ? `${value} ${field.config.unit}` : String(value);
}

export function statusLabel(status: string) {
  return ITEM_STATUSES.find((s) => s.value === status)?.label ?? status;
}
