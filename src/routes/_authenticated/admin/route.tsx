import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const [roles, perms] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.from("staff_permissions").select("permission").eq("user_id", data.user.id),
    ]);
    const roleList = (roles.data ?? []).map(r => (r as { role: string }).role);
    const permList = (perms.data ?? []).map(r => (r as { permission: string }).permission);
    const isStaff = roleList.some(r => ["super_admin", "admin", "staff"].includes(r)) || permList.length > 0;
    if (!isStaff) throw redirect({ to: "/dashboard" });
    return { roles: roleList, permissions: permList };
  },
  component: () => <Outlet />,
});
