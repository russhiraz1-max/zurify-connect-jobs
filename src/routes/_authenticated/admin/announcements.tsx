import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Admin" }] }),
  component: AdminAnnouncements,
});

type A = { id: string; title: string; body: string | null; audience: string; created_at: string };

function AdminAnnouncements() {
  const { user } = useSession();
  const [rows, setRows] = useState<A[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function load() {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as A[]);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!title) return;
    const { error } = await supabase.from("announcements").insert({ title, body, audience: "all", published_at: new Date().toISOString(), created_by: user?.id ?? null });
    if (error) return toast.error(error.message);
    setTitle(""); setBody("");
    toast.success("Published");
    load();
  }
  async function del(id: string) {
    await supabase.from("announcements").delete().eq("id", id);
    load();
  }

  return (
    <AdminShell title="Announcements">
      <Card className="mb-4 max-w-xl">
        <CardContent className="space-y-3 p-4">
          <div><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div><Label>Body</Label><Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} /></div>
          <Button onClick={create}>Publish announcement</Button>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {rows.map(r => (
          <Card key={r.id}>
            <CardContent className="flex items-start justify-between p-4">
              <div><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{dateTime(r.created_at)}</p>{r.body && <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>}</div>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}>Delete</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
