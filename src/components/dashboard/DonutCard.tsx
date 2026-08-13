import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Slice = { id: string; name: string; color: string; value: number };

export function DonutCard({
  title,
  slices,
  modes,
  mode,
  onModeChange,
  format,
}: {
  title: string;
  slices: Slice[];
  modes: Array<{ value: string; label: string }>;
  mode: string;
  onModeChange: (m: string) => void;
  format: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const { data, total } = useMemo(() => {
    const pos = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
    const total = pos.reduce((s, x) => s + x.value, 0);
    const top = pos.slice(0, 8);
    const rest = pos.slice(8);
    const data = rest.length
      ? [...top, { id: "__others", name: "Others", color: "var(--muted-foreground)", value: rest.reduce((s, x) => s + x.value, 0) }]
      : top;
    return { data, total };
  }, [slices]);

  const focus = data.find((d) => d.id === hover) ?? data[0];
  const pct = focus && total ? (focus.value / total) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <div className="flex rounded-full bg-secondary p-0.5">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                mode === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="relative h-[240px]">
          {total <= 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={2}
                    onMouseEnter={(_, i) => setHover(data[i]?.id ?? null)}
                    onMouseLeave={() => setHover(null)}
                    animationDuration={700}
                  >
                    {data.map((d) => (
                      <Cell key={d.id} fill={d.color} opacity={hover && hover !== d.id ? 0.35 : 1} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [`${format(v)} · ${((v / total) * 100).toFixed(1)}%`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold">{pct.toFixed(1)}%</div>
                  <div className="text-[11px] text-muted-foreground max-w-[120px] truncate">{focus?.name ?? "—"}</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
          {data.map((d) => (
            <div
              key={d.id}
              onMouseEnter={() => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-secondary/60 transition-colors"
            >
              <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="truncate font-medium">{d.name}</span>
              <span className="ml-auto text-muted-foreground shrink-0">
                {total ? ((d.value / total) * 100).toFixed(1) : "0"}%
              </span>
              <span className="w-16 text-right font-semibold shrink-0">{format(d.value)}</span>
            </div>
          ))}
          {data.length === 0 && <div className="text-xs text-muted-foreground px-2">No data</div>}
        </div>
      </CardContent>
    </Card>
  );
}
