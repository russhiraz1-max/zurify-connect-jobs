import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({ meta: [{ title: "Staff — Admin" }] }),
  component: AdminStaff,
});

const ALL_PERMS = [
  "review_submissions", "review_applications", "review_reports", "reply_tickets",
  "view_users", "view_tasks", "view_withdrawals", "approve_withdrawals",
];

type Staff = { id: string; full_name: string | null; user_roles: { role: string }[]; staff_permissions: { permission: string }[] };

function AdminStaff() {
  const [rows, setRows] = useState<Staff[]>([]);

  async function load() {
    const { data } = await supabase.from("profiles")
      .select("id,full_name,user_roles(role),staff_permissions(permission)")
      .limit(500);
    const filtered = (((data ?? []) as unknown) as Staff[]).filter(r => r.user_roles.some(x => ["staff", "super_admin", "admin"].includes(x.role)));
    setRows(filtered);
  }
  useEffect(() => { load(); }, []);

  async function toggle(userId: string, perm: string, has: boolean) {
    if (has) {
      await supabase.from("staff_permissions").delete().eq("user_id", userId).eq("permission", perm as never);
    } else {
      await supabase.from("staff_permissions").insert({ user_id: userId, permission: perm as never });
    }
    load();
  }

  async function remove(userId: string) {
    if (!confirm("Remove staff role?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "staff");
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <AdminShell title="Staff" subtitle="Manage staff roles and per-permission access.">
      <div className="space-y-4">
        {rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No staff yet. Add staff role from the Users page.</CardContent></Card>
        ) : rows.map(r => {
          const perms = new Set(r.staff_permissions.map(x => x.permission));
          const isSuper = r.user_roles.some(x => x.role === "super_admin");
          return (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-medium">{r.full_name ?? "—"} {isSuper && <Badge className="ml-2">super admin</Badge>}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.id.slice(0, 8)}</p>
                  </div>
                  {!isSuper && <Button size="sm" variant="outline" onClick={() => remove(r.id)}>Remove staff</Button>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ALL_PERMS.map(p => (
                    <label key={p} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                      <Checkbox checked={isSuper || perms.has(p)} disabled={isSuper} onCheckedChange={() => toggle(r.id, p, perms.has(p))} />
                      <span className="truncate">{p.replace(/_/g, " ")}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
