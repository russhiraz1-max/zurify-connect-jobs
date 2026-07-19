import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Admin" }] }),
  component: AdminNotifications,
});

type Row = { id: string; type: string; title: string; body: string | null; created_at: string; user_id: string };

function AdminNotifications() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("notifications").select("id,type,title,body,created_at,user_id").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  return (
    <AdminShell title="Recent notifications" subtitle="Recent user-facing notifications across the platform.">
      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nothing yet.</CardContent></Card>
        ) : rows.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{r.title}</p>
                <span className="text-xs text-muted-foreground">{dateTime(r.created_at)}</span>
              </div>
              {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
              <p className="mt-1 font-mono text-xs text-muted-foreground">{r.type} · user {r.user_id.slice(0, 8)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
