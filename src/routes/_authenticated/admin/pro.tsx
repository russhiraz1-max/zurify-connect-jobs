import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usd, dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/pro")({
  head: () => ({
    meta: [
      { title: "Zurify Pro — Admin" },
      { name: "description", content: "Review, activate, suspend and renew Zurify Pro memberships." },
    ],
  }),
  component: AdminPro,
});

type ProRow = {
  id: string; user_id: string; full_name: string | null; email: string | null; status: string;
  note: string | null; payment_reference: string | null; price_cents: number; duration_days: number;
  admin_notes: string | null; activated_at: string | null; expires_at: string | null; created_at: string;
};

function AdminPro() {
  const [rows, setRows] = useState<ProRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase.rpc("admin_list_pro_requests" as never);
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as ProRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.rpc("admin_set_pro_status" as never, { _id: id, _status: status, _notes: null } as never);
    if (error) return toast.error(error.message);
    toast.success(`Membership ${status}`);
    void load();
  }

  function exportCsv() {
    const head = "name,email,status,price,activated,expires\n";
    const body = rows.map(r => [r.full_name ?? "", r.email ?? "", r.status, usd(r.price_cents), r.activated_at ?? "", r.expires_at ?? ""].join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "zurify-pro-members.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell title="Zurify Pro" subtitle="Membership requests are approved manually once payment is confirmed.">
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0}>Export CSV</Button>
      </div>
      {loading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>}
      {!loading && rows.length === 0 && (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No membership requests yet.</CardContent></Card>
      )}
      <div className="space-y-3">
        {rows.map(r => (
          <Card key={r.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{r.full_name || "Unnamed member"}</p>
                  <Badge variant={r.status === "active" ? "default" : r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{r.email}</p>
                <p className="mt-2 text-sm">{usd(r.price_cents)} · {r.duration_days} days</p>
                {r.payment_reference && <p className="text-xs text-muted-foreground">Payment ref: {r.payment_reference}</p>}
                {r.note && <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested {dateTime(r.created_at)}{r.expires_at ? ` · expires ${dateTime(r.expires_at)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setStatus(r.id, "active")}>{r.status === "active" ? "Renew" : "Activate"}</Button>
                <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "suspended")}>Suspend</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "rejected")}>Reject</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
