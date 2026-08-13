import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export type RoundBarDatum = {
  label: string;
  date: string;
  winner: string;
  pot: number;
  minutes: number;
  players: number;
  rebuys: number;
};

export function RoundsBarChart({ data, currency }: { data: RoundBarDatum[]; currency: string }) {
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
          <YAxis yAxisId="money" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={52} />
          <YAxis yAxisId="count" orientation="right" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={36} />
          <Tooltip
            cursor={{ fill: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]!.payload as RoundBarDatum;
              return (
                <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg space-y-1">
                  <div className="font-semibold text-sm">{d.label}</div>
                  <div className="text-muted-foreground">{d.date} · winner {d.winner}</div>
                  <Row k="Total pot" v={`${currency}${d.pot.toLocaleString()}`} c="var(--chart-1)" />
                  <Row k="Played time" v={`${d.minutes} min`} c="var(--chart-2)" />
                  <Row k="Players" v={String(d.players)} c="var(--chart-3)" />
                  <Row k="Total re-buys" v={String(d.rebuys)} c="var(--chart-4)" />
                </div>
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="money" dataKey="pot" name="Total pot" fill="var(--chart-1)" radius={[5, 5, 0, 0]} />
          <Bar yAxisId="count" dataKey="minutes" name="Played time (min)" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
          <Bar yAxisId="count" dataKey="players" name="Players" fill="var(--chart-3)" radius={[5, 5, 0, 0]} />
          <Bar yAxisId="count" dataKey="rebuys" name="Total re-buys" fill="var(--chart-4)" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Row({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-2 rounded-full" style={{ background: c }} />
      <span className="text-muted-foreground">{k}</span>
      <span className="ml-auto font-semibold">{v}</span>
    </div>
  );
}
