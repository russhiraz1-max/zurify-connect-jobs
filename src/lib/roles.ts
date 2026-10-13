import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export type AppRole = "super_admin" | "staff" | "user" | "advertiser" | "job_seeker" | "employer" | "admin";
export type StaffPermission =
  | "review_submissions"
  | "review_reports"
  | "reply_tickets"
  | "view_users"
  | "view_tasks"
  | "view_withdrawals"
  | "approve_withdrawals"
  | "review_applications";

export function useRoles() {
  const { user, loading: sessionLoading } = useSession();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { setRoles([]); setPermissions([]); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [r, p] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("staff_permissions").select("permission").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setRoles(((r.data ?? []) as { role: AppRole }[]).map(x => x.role));
      setPermissions(((p.data ?? []) as { permission: StaffPermission }[]).map(x => x.permission));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, sessionLoading]);

  const isSuperAdmin = roles.includes("super_admin");
  // Match the database helper public.is_staff(), which recognizes only staff and super_admin.
  // The legacy `admin` role is not a trusted staff grant and must fail closed.
  const isStaff = isSuperAdmin || roles.includes("staff");
  const has = (perm: StaffPermission) => isSuperAdmin || permissions.includes(perm);

  return { roles, permissions, isSuperAdmin, isStaff, has, loading: loading || sessionLoading };
}
