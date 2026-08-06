import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

/**
 * Per-user lifecycle state for every job the member has touched.
 *
 * A job is:
 *  - completed: an approved submission exists — it can never be worked again
 *  - closed:    permanently rejected with no resubmission allowed
 *  - awaitingReview: a submission is pending review
 *  - approved:  an approved application, work not yet submitted
 *  - applied:   an application awaiting a decision
 *
 * Completed and closed jobs must be hidden from every actionable list.
 * Mirrors the server-side guards in apply_to_task / submit_task.
 */
export type JobProgress = {
  completed: Set<string>;
  closed: Set<string>;
  awaitingReview: Set<string>;
  needsResubmit: Set<string>;
  approved: Set<string>;
  applied: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
};

type SubRow = { task_id: string; status: string; tasks: { allow_reapplication: boolean } | null };
type AppRow = { task_id: string; status: string; tasks: { allow_reapplication: boolean } | null };

const empty = () => ({
  completed: new Set<string>(),
  closed: new Set<string>(),
  awaitingReview: new Set<string>(),
  needsResubmit: new Set<string>(),
  approved: new Set<string>(),
  applied: new Set<string>(),
});

export function useJobProgress(): JobProgress {
  const { user, loading: sessionLoading } = useSession();
  const [state, setState] = useState(empty);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setState(empty());
      setLoading(false);
      return;
    }
    const [subs, apps] = await Promise.all([
      supabase
        .from("task_submissions")
        .select("task_id,status,tasks(allow_reapplication)")
        .eq("user_id", user.id),
      supabase
        .from("task_applications")
        .select("task_id,status,tasks(allow_reapplication)")
        .eq("user_id", user.id),
    ]);

    const next = empty();
    for (const r of (subs.data ?? []) as unknown as SubRow[]) {
      if (r.status === "approved") next.completed.add(r.task_id);
      else if (r.status === "pending") next.awaitingReview.add(r.task_id);
      else if (r.status === "resubmit") next.needsResubmit.add(r.task_id);
      else if (r.status === "rejected" && !r.tasks?.allow_reapplication) next.closed.add(r.task_id);
    }
    for (const r of (apps.data ?? []) as unknown as AppRow[]) {
      if (r.status === "approved") next.approved.add(r.task_id);
      else if (r.status === "pending") next.applied.add(r.task_id);
      else if (r.status === "rejected" && !r.tasks?.allow_reapplication) next.closed.add(r.task_id);
    }
    // Completion always wins over any earlier in-flight state.
    for (const id of next.completed) {
      next.closed.delete(id);
      next.awaitingReview.delete(id);
      next.needsResubmit.delete(id);
      next.approved.delete(id);
      next.applied.delete(id);
    }
    setState(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (sessionLoading) return;
    void refresh();
  }, [refresh, sessionLoading]);

  return { ...state, loading: loading || sessionLoading, refresh };
}

/** Jobs that must never appear in browse / recommended / trending / recently viewed. */
export function isJobLockedForUser(id: string, p: Pick<JobProgress, "completed" | "closed">) {
  return p.completed.has(id) || p.closed.has(id);
}
