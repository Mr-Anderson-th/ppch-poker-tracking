import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type Badge = {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string | null;
  kind: "manual" | "auto";
  auto_rule: string | null;
};

export type PlayerBadge = {
  id: string;
  player_id: string;
  badge_id: string;
  season_id: string | null;
  note: string | null;
  awarded_at: string;
};

export function BadgeChip({
  badge,
  tooltip,
  size = "sm",
}: {
  badge: Pick<Badge, "icon" | "color" | "name">;
  tooltip?: string;
  size?: "xs" | "sm" | "md";
}) {
  const sizes = {
    xs: "size-5 text-[11px]",
    sm: "size-6 text-xs",
    md: "size-8 text-base",
  };
  const el = (
    <span
      className={`inline-grid place-items-center rounded-full ring-1 ring-border shadow-sm ${sizes[size]}`}
      style={{ background: `color-mix(in oklch, ${badge.color} 18%, transparent)` }}
      aria-label={badge.name}
    >
      <span>{badge.icon}</span>
    </span>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{el}</TooltipTrigger>
        <TooltipContent>
          <div className="font-semibold">{badge.name}</div>
          {tooltip && <div className="text-xs text-muted-foreground">{tooltip}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BadgeRow({
  badges,
  size = "sm",
}: {
  badges: Array<{ badge: Pick<Badge, "icon" | "color" | "name">; tooltip?: string }>;
  size?: "xs" | "sm" | "md";
}) {
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {badges.map((b, i) => (
        <BadgeChip key={i} badge={b.badge} tooltip={b.tooltip} size={size} />
      ))}
    </span>
  );
}
