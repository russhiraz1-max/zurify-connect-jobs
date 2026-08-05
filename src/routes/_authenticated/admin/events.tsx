import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/events")({
  head: () => ({
    meta: [
      { title: "Platform Events — Zurify Admin" },
      { name: "description", content: "Run time-limited campaigns such as holiday bonuses or referral weeks without touching code." },
    ],
  }),
  component: AdminEvents,
});

type EventRow = {
  id: string; name: string; description: string; banner_text: string | null;
  accent: string; starts_at: string; ends_at: string; status: string;
};

function AdminEvents() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("platform_events").select("*").order("ends_at", { ascending: false });
    setRows((data ?? []) as unknown as EventRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function add() {
    const { error } = await supabase.from("platform_events").insert({
      name: "New campaign", description: "", banner_text: "Something special is happening on Zurify",
    } as never);
    if (error) return toast.error(error.message);
    void load();
  }
  async function save(r: EventRow) {
    const { id, ...rest } = r;
    const { error } = await supabase.from("platform_events").update(rest as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campaign saved");
  }
  async function remove(id: string) {
    const { error } = await supabase.from("platform_events").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  }

  return (
    <AdminShell title="Platform events" subtitle="Time-limited campaigns shown as banners across member dashboards.">
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={add}><Plus className="mr-1 h-4 w-4" /> New campaign</Button>
      </div>
      {loading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>}
      {!loading && rows.length === 0 && (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No campaigns yet. Create one to promote a seasonal event.</CardContent></Card>
      )}
      <div className="space-y-4">
        {rows.map((r, i) => {
          const upd = (patch: Partial<EventRow>) => setRows(list => list.map((x, j) => (i === j ? { ...x, ...patch } : x)));
          const live = r.status === "active" && new Date(r.starts_at) <= new Date() && new Date(r.ends_at) >= new Date();
          return (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <Badge variant={live ? "default" : "secondary"}>{live ? "Live" : r.status}</Badge>
                  <span className="text-xs text-muted-foreground">Ends {dateTime(r.ends_at)}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Name</Label><Input value={r.name} onChange={e => upd({ name: e.target.value })} /></div>
                  <div><Label>Banner headline</Label><Input value={r.banner_text ?? ""} onChange={e => upd({ banner_text: e.target.value })} /></div>
                </div>
                <div><Label>Description</Label><Textarea rows={2} value={r.description} onChange={e => upd({ description: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><Label>Starts</Label><Input type="datetime-local" value={r.starts_at.slice(0, 16)} onChange={e => upd({ starts_at: new Date(e.target.value).toISOString() })} /></div>
                  <div><Label>Ends</Label><Input type="datetime-local" value={r.ends_at.slice(0, 16)} onChange={e => upd({ ends_at: new Date(e.target.value).toISOString() })} /></div>
                  <div>
                    <Label>Status</Label>
                    <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={r.status} onChange={e => upd({ status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="ended">Ended</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  <Button size="sm" onClick={() => save(r)}>Save</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
