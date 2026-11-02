import { Badge } from "@/components/ui/badge";
import { formatForecastDay } from "./engine";

const CONFIDENCE = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;

export function ForecastBadge({ state, confidence }: { state: string; confidence: keyof typeof CONFIDENCE | null }) {
  if (state === "not_enough_history") return <Badge variant="outline">Not enough history</Badge>;
  if (state === "slow") return <Badge variant="outline">Slow moving</Badge>;
  return <Badge variant={confidence === "high" ? "default" : confidence === "medium" ? "secondary" : "outline"}>{confidence ? CONFIDENCE[confidence] : "—"}</Badge>;
}

/** "3 Dec 2026", with the likely range underneath. */
export function StockoutDate({ day, earliest, latest }: { day: string | null; earliest: string | null; latest: string | null }) {
  if (!day) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <span className="font-medium">{formatForecastDay(day)}</span>
      <span className="text-muted-foreground block text-xs">
        {earliest ? formatForecastDay(earliest) : "Soon"} to {latest ? formatForecastDay(latest) : "over a year"}
      </span>
    </>
  );
}
