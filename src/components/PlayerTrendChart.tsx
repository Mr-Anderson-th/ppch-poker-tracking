import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export type TrendPoint = {
  date: string;
  roundName: string;
  finish: number;
  net: number;
  points: number;
};

type Metric = "net" | "points";
type Mode = "cumulative" | "per-round";

export function PlayerTrendChart({ data, currency }: { data: TrendPoint[]; currency: string }) {
  const [metric, setMetric] = useState<Metric>("net");
  const [mode, setMode] = useState<Mode>("cumulative");

  const series = useMemo(() => {
    let acc = 0;
    return data.map((d) => {
      const raw = metric === "net" ? d.net : d.points;
      acc += raw;
      return { ...d, value: mode === "cumulative" ? acc : raw };
    });
  }, [data, metric, mode]);

  const fmt = (v: number) =>
    metric === "net" ? `${v < 0 ? "-" : ""}${currency}${Math.abs(Math.round(v)).toLocaleString()}` : `${Math.round(v)} pts`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">
          {metric === "net" ? "Net money" : "Total points"} · {mode === "cumulative" ? "cumulative" : "per round"}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Toggle
            options={[
              { v: "net", l: "Net money" },
              { v: "points", l: "Points" },
            ]}
            value={metric}
            onChange={(v) => setMetric(v as Metric)}
          />
          <Toggle
            options={[
              { v: "cumulative", l: "Cumulative" },
              { v: "per-round", l: "Per round" },
            ]}
            value={mode}
            onChange={(v) => setMode(v as Mode)}
          />
        </div>
      </CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <div className="h-[260px] grid place-items-center text-muted-foreground text-sm">No rounds yet</div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in oklch, var(--foreground) 10%, transparent)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmt(v)} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--card-foreground)",
                  }}
                  labelFormatter={(_l: unknown, p: ReadonlyArray<{ payload?: TrendPoint }> = []) => {
                    const d = p?.[0]?.payload;
                    return d ? `${d.roundName} · ${format(new Date(d.date), "MMM d, yyyy")}` : "";
                  }}
                  formatter={((v: number, _n: unknown, p: { payload?: TrendPoint }) => {
                    const d = p?.payload;
                    return [`${fmt(v)}${d ? `  ·  finish #${d.finish}` : ""}`, mode === "cumulative" ? "Running total" : "This round"];
                  }) as never}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#trend-fill)"
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--primary)" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: string; l: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            value === o.v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
