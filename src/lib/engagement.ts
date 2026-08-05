import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EngagementSettings = {
  streak_enabled: boolean;
  lucky_enabled: boolean;
  mystery_enabled: boolean;
  challenges_enabled: boolean;
  badges_enabled: boolean;
  pro_enabled: boolean;
  pro_price_cents: number;
  pro_duration_days: number;
  pro_benefits: string[];
  lucky_open_time: string;
  lucky_duration_minutes: number;
  lucky_reward_cents: number;
  lucky_max_winners: number;
  mystery_frequency_days: number;
  streak_grace_days: number;
  streak_stage2_required_jobs: number;
  streak_stage3_required_jobs: number;
};

export type StreakState = {
  current: number;
  longest: number;
  last_claim_date: string | null;
  total_claimed_cents: number;
  claimed_today: boolean;
  next_day: number;
  next_reward_cents: number;
  approved_last_7: number;
};

export type LuckyState = {
  claimed_today: boolean;
  winners_today: number;
  last_amount_cents: number | null;
};

export type MysteryState = {
  period_key: string;
  opened: boolean;
  last: { label: string; amount_cents: number; created_at: string } | null;
};

export type ChallengeState = {
  id: string;
  name: string;
  description: string;
  metric: string;
  target: number;
  reward_cents: number;
  starts_at: string;
  ends_at: string;
  progress: number;
  claimed: boolean;
};

export type Reputation = {
  trust_score: number;
  stars: number;
  label: string;
  approved_jobs: number;
  rejected_jobs: number;
  total_submissions: number;
  approval_rate: number;
  kyc_verified: boolean;
  clean_record: boolean;
  account_age_days: number;
  withdrawals: number;
  recent_actions: number;
};

export type BadgeState = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  metric: string;
  earned_at: string | null;
};

export type PlatformEvent = {
  id: string;
  name: string;
  banner_text: string | null;
  description: string;
  accent: string;
  ends_at: string;
};

export type Engagement = {
  settings: EngagementSettings;
  streak: StreakState;
  lucky: LuckyState;
  mystery: MysteryState;
  challenges: ChallengeState[];
  reputation: Reputation;
  badges: BadgeState[];
  pro: { status: string; expires_at: string | null; created_at: string } | null;
  events: PlatformEvent[];
};

export const CHALLENGE_METRICS = [
  { value: "approved_jobs", label: "Approved jobs" },
  { value: "submissions", label: "Submissions sent" },
  { value: "referrals", label: "New referrals" },
  { value: "earned_cents", label: "Amount earned (cents)" },
  { value: "streak", label: "Current streak (days)" },
] as const;

export const BADGE_METRICS = [
  { value: "approved_jobs", label: "Approved jobs" },
  { value: "stars", label: "Star rating" },
  { value: "kyc_approved", label: "Identity verified" },
  { value: "withdrawals", label: "Approved withdrawals" },
  { value: "streak", label: "Longest streak" },
  { value: "referrals", label: "Referrals" },
] as const;

export function starLabel(stars: number) {
  return "★".repeat(Math.max(0, stars)) + "☆".repeat(Math.max(0, 5 - stars));
}

export function useEngagement() {
  const [data, setData] = useState<Engagement | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: res, error } = await supabase.rpc("get_my_engagement" as never);
    if (!error && res) setData(res as unknown as Engagement);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, refresh };
}

/** Milliseconds until the next lucky window opens, and whether it is open right now. */
export function luckyWindow(openTime: string, durationMinutes: number) {
  const [h, m] = openTime.split(":").map(Number);
  const now = new Date();
  const open = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h || 0, m || 0, 0, 0,
  ));
  const close = new Date(open.getTime() + durationMinutes * 60_000);
  if (now >= open && now <= close) {
    return { open: true, msLeft: close.getTime() - now.getTime() };
  }
  const next = now > close ? new Date(open.getTime() + 86_400_000) : open;
  return { open: false, msLeft: next.getTime() - now.getTime() };
}

export function countdown(ms: number) {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
}
