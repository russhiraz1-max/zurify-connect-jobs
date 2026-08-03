import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Server-authoritative suspension gate: suspended accounts never reach any
    // authenticated route.
    const { data: statusRows } = await supabase.rpc("get_my_account_status" as never);
    const status = (statusRows as { suspended: boolean }[] | null)?.[0];
    if (status?.suspended) throw redirect({ to: "/suspended" });

    return { user: data.user };
  },
  component: () => <Outlet />,
});
