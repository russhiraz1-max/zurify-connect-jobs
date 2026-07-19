import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  head: () => ({ meta: [{ title: "Audit logs — Admin" }] }),
  component: AdminAudit,
});

type Row = { id: string; action: string; target_type: string | null; target_id: string | null; actor_id: string | null; created_at: string };

function AdminAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("id,action,target_type,target_id,actor_id,created_at").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);

  return (
    <AdminShell title="Audit logs" subtitle="Every privileged action is recorded here.">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>Actor</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{dateTime(r.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{r.action}</TableCell>
                  <TableCell className="font-mono text-xs">{r.target_type ?? "—"} · {r.target_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.actor_id?.slice(0, 8) ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
