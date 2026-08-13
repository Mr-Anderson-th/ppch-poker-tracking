import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function MiniKpi({
  icon: Icon,
  tint = "primary",
  label,
  value,
  sub,
  delta,
  invert = false,
}: {
  icon: React.ElementType;
  tint?: "primary" | "warning" | "success" | "info";
  label: string;
  value: string;
  sub?: string | null;
  /** percent change vs previous period; null = no comparison */
  delta?: number | null;
  /** when true, a negative delta is good (e.g. re-buys) */
  invert?: boolean;
}) {
  const tints: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/15 text-warning",
    success: "bg-success/15 text-success",
    info: "bg-info/15 text-info",
  };
  const has = delta != null && Number.isFinite(delta);
  const up = has && delta! > 0;
  const flat = has && Math.abs(delta!) < 0.5;
  const good = invert ? !up : up;
  const TrendIcon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className={`size-8 rounded-lg grid place-items-center shrink-0 ${tints[tint]}`}>
            <Icon className="size-4" />
          </div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</div>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
          </div>
          {has && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${
                flat
                  ? "bg-secondary text-muted-foreground"
                  : good
                    ? "bg-success/15 text-success"
                    : "bg-destructive/15 text-destructive"
              }`}
            >
              <TrendIcon className="size-3" />
              {Math.abs(delta!).toFixed(0)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
