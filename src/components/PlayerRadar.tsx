import { RadarChart, Radar, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

import type { PlayerAxes } from "@/lib/points";

export type { PlayerAxes };

const AXIS_LABELS: Array<{ key: keyof PlayerAxes; label: string; short: string; desc: string }> = [
  { key: "survival", label: "Survival", short: "SUR", desc: "อยู่รอดจนช่วงท้ายทัวร์นาเมนต์" },
  { key: "discipline", label: "Discipline", short: "DIS", desc: "Re-buy น้อย = คะแนนสูง" },
  { key: "cashRate", label: "Cash Rate", short: "ITM", desc: "เข้าเงินบ่อยแค่ไหน" },
  { key: "earningPower", label: "Earning Power", short: "HR", desc: "ทำเงินต่อชั่วโมงเทียบคนที่ดีที่สุด" },
  { key: "consistency", label: "Consistency", short: "CON", desc: "อันดับที่ตกรอบเทียบผู้เล่นทั้งหมด" },
];

export function PlayerRadar({ axes, compareAxes }: { axes: PlayerAxes; compareAxes?: PlayerAxes }) {
  const data = AXIS_LABELS.map((a) => ({
    axis: a.label,
    you: Math.max(0, Math.min(10, axes[a.key])),
    avg: compareAxes ? Math.max(0, Math.min(10, compareAxes[a.key])) : undefined,
  }));

  const overall = (Object.values(axes).reduce((s, v) => s + v, 0) / 5);

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%),linear-gradient(180deg,#0b0f1a,#050813)] p-4">
      {/* Neon corner ticks */}
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(90deg,transparent_49.5%,color-mix(in_oklch,var(--primary)_30%,transparent)_50%,transparent_50.5%),linear-gradient(0deg,transparent_49.5%,color-mix(in_oklch,var(--primary)_15%,transparent)_50%,transparent_50.5%)] [background-size:32px_32px]" />

      <div className="relative flex items-start justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-primary/80">Skill matrix</div>
          <h3 className="text-lg font-bold text-white">Player Rating</h3>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-primary/80">Overall</div>
          <div className="text-3xl font-black tabular-nums text-white drop-shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_80%,transparent)]">
            {overall.toFixed(1)}
            <span className="text-sm text-primary/70 font-semibold">/10</span>
          </div>
        </div>
      </div>

      <div className="relative h-[320px] animate-fade-in">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <defs>
              <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.7} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.15} />
              </radialGradient>
              <filter id="radar-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <PolarGrid stroke="color-mix(in oklch, var(--primary) 30%, transparent)" strokeDasharray="2 4" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 11, fill: "#e4e9f5", fontWeight: 600, letterSpacing: 1 }}
            />
            <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
            {compareAxes && (
              <Radar
                name="Group avg"
                dataKey="avg"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="#94a3b8"
                fillOpacity={0.05}
                isAnimationActive
                animationDuration={900}
                animationBegin={200}
              />
            )}
            <Radar
              name="You"
              dataKey="you"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="url(#radar-fill)"
              fillOpacity={0.85}
              isAnimationActive
              animationDuration={1400}
              animationBegin={100}
              animationEasing="ease-out"
              style={{ filter: "url(#radar-glow)" }}
              dot={{ r: 4, fill: "var(--primary)", stroke: "#fff", strokeWidth: 1.5 }}
            />
            <Tooltip
              contentStyle={{ background: "rgba(5,10,25,0.95)", border: "1px solid color-mix(in oklch, var(--primary) 40%, transparent)", borderRadius: 8, fontSize: 12, color: "#fff" }}
              formatter={(v: number) => `${v.toFixed(1)} / 10`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="relative mt-3 grid grid-cols-5 gap-1.5">
        {AXIS_LABELS.map((a) => {
          const v = data.find((d) => d.axis === a.label)?.you ?? 0;
          return (
            <div key={a.key} className="rounded-lg border border-primary/20 bg-black/40 p-2 text-center">
              <div className="text-[9px] uppercase tracking-widest text-primary/80" title={a.desc}>{a.short}</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-white drop-shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_60%,transparent)]">
                {v.toFixed(1)}
              </div>
              <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-[width] duration-1000 ease-out"
                  style={{ width: `${(v / 10) * 100}%`, boxShadow: "0 0 8px color-mix(in oklch, var(--primary) 80%, transparent)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
