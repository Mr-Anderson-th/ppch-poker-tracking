import type { Player } from "@/lib/queries";

const SIZE: Record<string, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-12 text-base",
  xl: "size-16 text-2xl",
};

function initials(name: string) {
  return name.split(" ").map((c) => c[0]).join("").slice(0, 2).toUpperCase();
}

export function PlayerAvatar({
  player,
  size = "md",
  className = "",
}: {
  player: Pick<Player, "name" | "avatar_color" | "avatar_url">;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const cls = `${SIZE[size]} rounded-full grid place-items-center font-bold text-white shrink-0 overflow-hidden ${className}`;
  if (player.avatar_url) {
    return (
      <span className={cls} style={{ background: player.avatar_color ?? "#6366f1" }}>
        <img src={player.avatar_url} alt={player.name} className="w-full h-full object-cover" />
      </span>
    );
  }
  return (
    <span className={cls} style={{ background: player.avatar_color ?? "#6366f1" }}>
      {initials(player.name)}
    </span>
  );
}
