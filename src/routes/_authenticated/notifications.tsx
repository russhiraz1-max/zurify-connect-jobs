import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Zurify" }] }),
  component: NotificationsPage,
});

type Row = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

function NotificationsPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    load();
  }

  return (
    <AppShell title="Notifications">
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
      </div>
      {rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No notifications yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <Card key={r.id} className={r.read_at ? "opacity-70" : ""}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Bell className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.title}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateTime(r.created_at)}</span>
                  </div>
                  {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                  {r.link && <Link to={r.link} className="mt-1 inline-block text-xs text-primary hover:underline">Open</Link>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
