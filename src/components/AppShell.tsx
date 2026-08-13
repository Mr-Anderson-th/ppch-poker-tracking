import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Timer, Users, ListOrdered, Lock, Unlock, Spade, Trophy, Crown } from "lucide-react";
import { useAdminUnlocked, setAdminPassword } from "@/lib/admin-store";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leaderboard", label: "Leaderboard", icon: Crown },
  { to: "/clock", label: "Clock", icon: Timer },

  { to: "/players", label: "Players", icon: Users },
  { to: "/rounds", label: "Rounds", icon: ListOrdered },
  { to: "/seasons", label: "Seasons", icon: Trophy },
];

export function AppShell() {
  const unlocked = useAdminUnlocked();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname === "/") return <Outlet />;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex md:w-60 lg:w-64 border-r border-border bg-sidebar flex-col">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-sm btn-glow">
            <Spade className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-[15px] leading-none">PPCH</div>
            <div className="text-[11px] text-muted-foreground mt-1 truncate">Pakree Poker Clue House</div>
          </div>
        </div>
        <nav className="px-3 py-2 space-y-1 flex-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary/12 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_20%,transparent)]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:translate-x-0.5"
                }`}
              >
                <n.icon className="size-[18px]" />
                {n.label}
              </Link>
            );
          })}
          <Link
            to="/admin"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              pathname.startsWith("/admin")
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:translate-x-0.5"
            }`}
          >
            {unlocked ? <Unlock className="size-[18px]" /> : <Lock className="size-[18px]" />}
            Admin
          </Link>
        </nav>
        <div className="p-3 border-t border-border">
          {unlocked ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground"
              onClick={() => setAdminPassword(null)}
            >
              <Lock className="size-4 mr-2" /> Lock admin
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground px-2 py-1">View-only mode</div>
          )}
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Spade className="size-4" />
            </div>
            <span className="font-display font-bold text-sm">PPCH</span>
          </Link>
          <div className="flex items-center gap-1">
              <Link to="/admin" className="text-xs text-muted-foreground p-2">
              {unlocked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            </Link>
          </div>
        </div>
        <nav className="flex overflow-x-auto px-2 pb-2 gap-1">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                  active ? "bg-primary text-primary-foreground btn-glow" : "bg-secondary text-secondary-foreground"
                }`}
              >
                <n.icon className="size-3.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 min-w-0 pt-[6.5rem] md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
