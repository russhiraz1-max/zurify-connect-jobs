import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { shortDate, usd } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
  component: AdminUsers,
});

type Row = {
  id: string; full_name: string | null; created_at: string;
  wallets: { available_cents: number; lifetime_earned_cents: number } | null;
  user_roles: { role: string }[];
};

function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase.from("profiles")
      .select("id,full_name,created_at,wallets(available_cents,lifetime_earned_cents),user_roles(role)")
      .order("created_at", { ascending: false }).limit(500);
    setRows((data ?? []) as Row[]);
  }
  useEffect(() => { load(); }, []);

  async function setRole(userId: string, role: string) {
    if (!confirm(`Assign role "${role}"?`)) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as never });
    if (error) return toast.error(error.message);
    toast.success("Role added");
    load();
  }
  async function removeRole(userId: string, role: string) {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role as never);
    if (error) return toast.error(error.message);
    toast.success("Role removed");
    load();
  }

  const filtered = rows.filter(r => !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell title="Users" subtitle="Manage accounts and roles.">
      <div className="mb-4">
        <Input placeholder="Search…" className="sm:w-72" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Name</TableHead><TableHead>Roles</TableHead><TableHead>Balance</TableHead><TableHead>Lifetime</TableHead><TableHead>Joined</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell><p className="font-medium">{r.full_name ?? "—"}</p><p className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</p></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.user_roles.map(x => (
                        <Badge key={x.role} variant="secondary" className="cursor-pointer" onClick={() => removeRole(r.id, x.role)} title="Click to remove">{x.role}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{usd(r.wallets?.available_cents ?? 0)}</TableCell>
                  <TableCell>{usd(r.wallets?.lifetime_earned_cents ?? 0)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{shortDate(r.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setRole(r.id, "staff")}>+ Staff</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
