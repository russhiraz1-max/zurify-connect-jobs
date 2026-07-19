import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/submissions")({
  head: () => ({ meta: [{ title: "Submissions — Zurify" }] }),
  component: SubmissionsPage,
});

type Row = {
  id: string; status: "pending" | "approved" | "rejected" | "resubmit";
  created_at: string; rejection_reason: string | null; review_notes: string | null;
  tasks: { id: string; title: string; reward_cents: number } | null;
};

function SubmissionsPage() {
  const { user } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState("pending");

  useEffect(() => {
    if (!user) return;
    supabase.from("task_submissions")
      .select("id,status,created_at,rejection_reason,review_notes,tasks(id,title,reward_cents)")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [user?.id]);

  const filtered = rows.filter(r => tab === "all" || r.status === tab);

  return (
    <AppShell title="My submissions" subtitle="Track your task submissions and their reviews.">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="resubmit">Resubmit</TabsTrigger>
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
                  <p className="text-xs text-muted-foreground">Submitted {dateTime(r.created_at)}</p>
                  {r.rejection_reason && <p className="mt-1 text-xs text-destructive">Reason: {r.rejection_reason}</p>}
                  {r.review_notes && <p className="mt-1 text-xs text-muted-foreground">Note: {r.review_notes}</p>}
                </div>
                <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>{r.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
