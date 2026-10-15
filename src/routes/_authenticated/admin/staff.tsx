import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/staff")({
  head: () => ({ meta: [{ title: "Staff — Admin" }] }),
  component: AdminStaff,
});

// Permissions Super Admin can grant to staff. Staff can never gain super-admin-only surfaces.
const ALL_PERMS = [
  "review_applications", "review_submissions", "approve_withdrawals",
  "review_reports", "reply_tickets", "view_tasks", "view_withdrawals",
  "review_ai_companies", "review_ai_projects",
] as const;

type Staff = {
  id: string; email: string | null; full_name: string | null; avatar_url: string | null;
  created_at: string; last_sign_in_at: string | null;
  is_super_admin: boolean; permissions: string[];
};

function AdminStaff() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_staff");
    if (error) toast.error(error.message);
    setRows(((data ?? []) as unknown) as Staff[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(userId: string, perm: string, has: boolean) {
    if (has) {
      const { error } = await supabase.from("staff_permissions").delete()
        .eq("user_id", userId).eq("permission", perm as never);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("staff_permissions")
        .insert({ user_id: userId, permission: perm as never });
      if (error) return toast.error(error.message);
    }
    load();
  }

  async function remove(userId: string) {
    if (!confirm("Remove staff role and all permissions?")) return;
    const { error } = await supabase.rpc("admin_remove_staff", { _user_id: userId });
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  }

  return (
    <AdminShell title="Staff" subtitle="Only super admins can promote or remove staff and edit their permissions.">
      <div className="space-y-4">
        {loading ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : rows.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            No staff yet. Promote a user from the Users page.
          </CardContent></Card>
        ) : rows.map(r => {
          const perms = new Set(r.permissions);
          return (
            <Card key={r.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                      : <div className="h-10 w-10 rounded-full bg-muted" />}
                    <div>
                      <p className="font-medium">
                        {r.full_name ?? "—"}{" "}
                        {r.is_super_admin && <Badge className="ml-1">super admin</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">{r.email ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Joined {shortDate(r.created_at)}
                        {r.last_sign_in_at && ` • Last sign-in ${shortDate(r.last_sign_in_at)}`}
                      </p>
                    </div>
                  </div>
                  {!r.is_super_admin && (
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}>Remove Staff</Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ALL_PERMS.map(p => (
                    <label key={p} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                      <Checkbox
                        checked={r.is_super_admin || perms.has(p)}
                        disabled={r.is_super_admin}
                        onCheckedChange={() => toggle(r.id, p, perms.has(p))}
                      />
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
