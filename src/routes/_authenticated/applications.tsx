import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({ meta: [{ title: "Applications — Zurify" }] }),
  component: ApplicationsPage,
});

type Row = {
  id: string; status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string; rejection_reason: string | null;
  tasks: { id: string; title: string; reward_cents: number } | null;
};

function ApplicationsPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("pending");

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("task_applications")
      .select("id,status,created_at,rejection_reason,tasks(id,title,reward_cents)")
      .eq("user_id", user.id).order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  async function cancel(id: string) {
    const { error } = await supabase.rpc("cancel_application", { _id: id });
    if (error) return toast.error(error.message);
    toast.success("Application cancelled");
    load();
  }

  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <AppShell title="My applications" subtitle="Track approvals and unlock tasks.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Nothing here yet.</CardContent></Card>
          ) : filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <Link to="/tasks/$id" params={{ id: r.tasks?.id ?? "" }} className="truncate font-medium hover:underline">
                    {r.tasks?.title ?? "Task"}
                  </Link>
                  <p className="text-xs text-muted-foreground">Applied {dateTime(r.created_at)}</p>
                  {r.rejection_reason && <p className="mt-1 text-xs text-destructive">Reason: {r.rejection_reason}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
                  {r.status === "pending" && <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>Cancel</Button>}
                  {r.status === "approved" && <Button size="sm" asChild><Link to="/tasks/$id" params={{ id: r.tasks?.id ?? "" }}>Start</Link></Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
