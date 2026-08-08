import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { useSeasons } from "@/lib/queries";
import { format } from "date-fns";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/seasons")({
  head: () => ({ meta: [{ title: "Seasons — PPCH" }] }),
  component: SeasonsPage,
});

function SeasonsPage() {
  const { data: seasons = [] } = useSeasons();
  const active = seasons.find((s) => !s.ended_at);
  const past = seasons.filter((s) => s.ended_at);

  return (
    <div className="p-4 md:p-8 max-w-[1100px] mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Trophy className="size-6 text-primary" /> Seasons
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Frozen leaderboards from every closed season.</p>
      </header>

      {active && (
        <Card className="felt">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current season</div>
              <div className="text-xl font-bold mt-1">{active.name}</div>
              <div className="text-xs text-muted-foreground mt-1">Started {format(new Date(active.started_at), "MMM d, yyyy")}</div>
            </div>
            <Link to="/dashboard" className="text-primary text-sm hover:underline">View live leaderboard →</Link>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Past seasons</h2>
        {past.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No past seasons yet.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {past.map((s) => (
              <Link key={s.id} to="/seasons/$id" params={{ id: s.id }}>
                <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(s.started_at), "MMM d, yyyy")} → {s.ended_at ? format(new Date(s.ended_at), "MMM d, yyyy") : "—"}
                      </div>
                    </div>
                    <span className="text-primary text-sm">View →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
