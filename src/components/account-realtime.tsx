import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const PERMISSION_ASKED_KEY = "zurify.notify.asked";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
};

/** Short synthesized chime — avoids shipping a binary asset. */
function playChime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1180, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    /* audio is best-effort */
  }
}

function vibrate() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* ignore */
  }
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied" as const;
  }
}

/**
 * Mounted once at the app root. Handles:
 *  - asking for browser notification permission after sign-in
 *  - realtime delivery of new notifications (browser notification + sound + vibration + toast)
 *  - instant enforcement when an administrator suspends the account
 */
export function AccountRealtime() {
  const { user } = useSession();
  const navigate = useNavigate();
  const navRef = useRef(navigate);
  navRef.current = navigate;

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (window.localStorage.getItem(PERMISSION_ASKED_KEY)) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(PERMISSION_ASKED_KEY, "1");
      void requestNotificationPermission();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`account-realtime-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          playChime();
          vibrate();
          toast(row.title, {
            description: row.body ?? undefined,
            action: row.link
              ? { label: "Open", onClick: () => navRef.current({ to: row.link as string }) }
              : undefined,
          });
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              const n = new Notification(row.title, { body: row.body ?? undefined, tag: row.id, icon: "/favicon.ico" });
              n.onclick = () => {
                window.focus();
                if (row.link) navRef.current({ to: row.link as string });
              };
            } catch {
              /* some browsers require a service worker; toast already shown */
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as { suspended?: boolean };
          if (row.suspended) {
            toast.error("Your account has been suspended.");
            navRef.current({ to: "/suspended", replace: true });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
