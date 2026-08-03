import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

export type AccountStatus = {
  suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  withdrawal_hold: boolean;
};

export async function fetchAccountStatus(): Promise<AccountStatus | null> {
  const { data, error } = await supabase.rpc("get_my_account_status" as never);
  if (error) return null;
  const row = (data as AccountStatus[] | null)?.[0];
  return row ?? null;
}

/** Live account status. Realtime-backed so a suspension takes effect instantly. */
export function useAccountStatus() {
  const { user, loading: sessionLoading } = useSession();
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const s = await fetchAccountStatus();
      if (!cancelled) {
        setStatus(s);
        setLoading(false);
      }
    };
    load();

    const channel = supabase
      .channel(`account-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => { load(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, sessionLoading]);

  return { status, loading: loading || sessionLoading };
}
