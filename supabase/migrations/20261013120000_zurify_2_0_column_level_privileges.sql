-- Zurify 2.0 security hardening: narrow direct client writes.
-- This migration is intended for the isolated 2.0 schema first. Do not apply
-- to production until the complete migration chain and client flows are tested.

-- Profile rows are created by the SECURITY DEFINER auth trigger. Clients only
-- need to edit the profile fields exposed by the current profile form.
REVOKE INSERT, UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, headline, bio, location, website)
  ON TABLE public.profiles TO authenticated;

-- Application review state must only be changed by the audited review/cancel
-- RPCs. The browser currently edits application details through the RPC flow;
-- preserve direct edits only for non-privileged application content.
REVOKE UPDATE ON TABLE public.task_applications FROM authenticated;
GRANT UPDATE (note, cover_letter, experience, cv_path)
  ON TABLE public.task_applications TO authenticated;

-- RLS still controls which rows may be updated. Column grants additionally
-- prevent authenticated clients from changing status/reviewer/review metadata,
-- and prevent direct profile writes to suspended/withdrawal_hold.
