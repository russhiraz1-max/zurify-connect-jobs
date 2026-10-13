-- Zurify 2.0: reject a withdrawal only when the entire reserved amount can be
-- released. This avoids silently masking a reserve mismatch with GREATEST/LEAST.
-- Source-only until exercised against a disposable 2.0 database.

CREATE OR REPLACE FUNCTION public.reject_withdrawal(
  _id uuid,
  _reason text,
  _suspend_withdrawals boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  w RECORD;
BEGIN
  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(), 'approve_withdrawals')
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO r
    FROM public.withdrawal_requests
    WHERE id = _id
    FOR UPDATE;

  IF NOT FOUND OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'Withdrawal not pending';
  END IF;

  SELECT *
    INTO w
    FROM public.wallets
    WHERE user_id = r.user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- A rejection must release the exact reserve or fail atomically for review.
  IF w.pending_withdrawal_cents < r.amount_cents THEN
    RAISE EXCEPTION 'Reserve mismatch; withdrawal requires reconciliation';
  END IF;

  UPDATE public.wallets
    SET pending_withdrawal_cents = pending_withdrawal_cents - r.amount_cents,
        available_cents = available_cents + r.amount_cents
    WHERE id = w.id;

  UPDATE public.withdrawal_requests
    SET status = 'rejected',
        reviewer_id = auth.uid(),
        rejection_reason = COALESCE(NULLIF(btrim(_reason), ''), 'Withdrawal rejected.'),
        processed_at = now()
    WHERE id = r.id;

  IF _suspend_withdrawals THEN
    UPDATE public.profiles
      SET withdrawal_hold = true
      WHERE id = r.user_id;

    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (
      r.user_id,
      'withdrawal_hold_enabled',
      'Withdrawals on hold',
      'Your withdrawals have been paused. You can continue earning; contact support for details.',
      '/support'
    );
  END IF;

  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (
    r.user_id,
    'withdrawal_rejected',
    'Withdrawal rejected',
    COALESCE(NULLIF(btrim(_reason), ''), 'Withdrawal rejected.'),
    '/withdrawals'
  );

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (
    auth.uid(),
    'reject_withdrawal',
    'withdrawal_requests',
    r.id,
    jsonb_build_object(
      'reason', COALESCE(NULLIF(btrim(_reason), ''), 'Withdrawal rejected.'),
      'suspend', _suspend_withdrawals,
      'released_cents', r.amount_cents
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text, boolean) TO authenticated;
