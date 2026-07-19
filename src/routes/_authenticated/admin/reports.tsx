import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — Admin" }] }),
  component: AdminReports,
});

type Row = { id: string; reason: string; details: string | null; status: string; target_type: string; target_id: string; created_at: string };

function AdminReports() {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); }, []);

  async function update(id: string, status: string) {
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <AdminShell title="Reports">
      {rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No reports.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map(r => (
            <Card key={r.id}>
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{r.reason}</p>
                  <p className="text-xs text-muted-foreground">{r.target_type} · {r.target_id.slice(0, 8)} · {dateTime(r.created_at)}</p>
                  {r.details && <p className="mt-2 text-sm">{r.details}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={r.status === "resolved" ? "default" : "secondary"}>{r.status}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => update(r.id, "investigating")}>Investigate</Button>
                    <Button size="sm" onClick={() => update(r.id, "resolved")}>Resolve</Button>
                    <Button size="sm" variant="ghost" onClick={() => update(r.id, "dismissed")}>Dismiss</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
