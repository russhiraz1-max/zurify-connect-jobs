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
  id: string; email: string | null; full_name: string | null; avatar_url: string | null;
  created_at: string; last_sign_in_at: string | null;
  suspended: boolean; withdrawal_hold: boolean;
  available_cents: number; pending_withdrawal_cents: number;
  lifetime_earned_cents: number; lifetime_withdrawn_cents: number;
  roles: string[];
  applications_count: number; approved_tasks: number; pending_tasks: number; withdrawals_count: number;
};

function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function call(fn: "admin_promote_staff" | "admin_remove_staff", user_id: string, confirmMsg: string) {
    if (!confirm(confirmMsg)) return;
    const { error } = await supabase.rpc(fn, { _user_id: user_id });
    if (error) return toast.error(error.message);
    toast.success("Done");
    load();
  }
  async function setSuspended(user_id: string, suspended: boolean) {
    let reason: string | null = null;
    if (suspended) {
      reason = window.prompt("Reason for suspension (shown to the user):", "");
      if (reason === null) return;
    } else if (!confirm("Reactivate this account?")) {
      return;
    }
    const { error } = await supabase.rpc("admin_set_suspended" as never, {
      _user_id: user_id, _suspended: suspended, _reason: reason,
    } as never);
    if (error) return toast.error(error.message);
    toast.success(suspended ? "Suspended — all sessions blocked" : "Reactivated");
    load();
  }
  async function setHold(user_id: string, hold: boolean) {
    const { error } = await supabase.rpc("admin_set_withdrawal_hold", { _user_id: user_id, _hold: hold });
    if (error) return toast.error(error.message);
    toast.success(hold ? "Withdrawals paused" : "Withdrawals enabled");
    load();
  }

  const filtered = rows.filter(r => !q ||
    (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (r.email ?? "").toLowerCase().includes(q.toLowerCase()));

  return (
    <AdminShell title="Users" subtitle="Manage accounts, roles, suspensions, and withdrawal access.">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Input placeholder="Search name or email…" className="sm:w-80" value={q} onChange={e => setQ(e.target.value)} />
        <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="p-8 text-center text-sm text-muted-foreground">No users.</TableCell></TableRow>
              ) : filtered.map(r => {
                const isStaff = r.roles.some(x => ["staff","super_admin","admin"].includes(x));
                const isSuper = r.roles.some(x => ["super_admin","admin"].includes(x));
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {r.avatar_url
                          ? <img src={r.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          : <div className="h-8 w-8 rounded-full bg-muted" />}
                        <div>
                          <p className="font-medium">{r.full_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{r.email ?? "—"}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{r.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.roles.length === 0
                          ? <Badge variant="outline">user</Badge>
                          : r.roles.map(role => <Badge key={role} variant="secondary">{role}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>Bal: <span className="font-medium">{usd(r.available_cents)}</span></div>
                        {r.pending_withdrawal_cents > 0 && <div className="text-muted-foreground">Pending: {usd(r.pending_withdrawal_cents)}</div>}
                        <div className="text-muted-foreground">Earned: {usd(r.lifetime_earned_cents)}</div>
                        <div className="text-muted-foreground">Withdrawn: {usd(r.lifetime_withdrawn_cents)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        <div>Apps: {r.applications_count}</div>
                        <div>Approved: {r.approved_tasks} • Pending: {r.pending_tasks}</div>
                        <div>Withdrawals: {r.withdrawals_count}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {r.suspended
                          ? <Badge variant="destructive">Suspended</Badge>
                          : <Badge variant="outline">Active</Badge>}
                        {r.withdrawal_hold && <Badge variant="destructive">Withdrawals hold</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{shortDate(r.created_at)}</div>
                      {r.last_sign_in_at && <div>Last: {shortDate(r.last_sign_in_at)}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {!isSuper && (isStaff
                          ? <Button size="sm" variant="outline" onClick={() => call("admin_remove_staff", r.id, "Remove staff role?")}>Remove Staff</Button>
                          : <Button size="sm" variant="outline" onClick={() => call("admin_promote_staff", r.id, "Promote to staff?")}>Promote to Staff</Button>)}
                        {!isSuper && (r.suspended
                          ? <Button size="sm" onClick={() => setSuspended(r.id, false)}>Unsuspend</Button>
                          : <Button size="sm" variant="destructive" onClick={() => setSuspended(r.id, true)}>Suspend</Button>)}
                        {r.withdrawal_hold
                          ? <Button size="sm" variant="outline" onClick={() => setHold(r.id, false)}>Enable withdrawals</Button>
                          : <Button size="sm" variant="outline" onClick={() => setHold(r.id, true)}>Pause withdrawals</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
