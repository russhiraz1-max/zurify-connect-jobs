-- Zurify 2.0: require approved KYC before reserving a withdrawal, and
-- make the legacy two-argument rejection RPC delegate to the reserve-releasing
-- implementation. Test on a disposable database before any production use.

CREATE OR REPLACE FUNCTION public.request_withdrawal(
  _amount_cents integer,
  _method public.withdrawal_method,
  _destination jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s RECORD;
  w RECORD;
  p RECORD;
  fee integer;
  net integer;
  wid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT suspended, withdrawal_hold
    INTO p
    FROM public.profiles
    WHERE id = auth.uid()
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;
  IF p.suspended THEN
    RAISE EXCEPTION 'Account is suspended';
  END IF;
  IF p.withdrawal_hold THEN
    RAISE EXCEPTION 'Withdrawals are currently on hold for your account';
  END IF;

  -- Withdrawals are a freelancer capability, not a general authenticated-user
  -- capability. Fail closed for client, staff, advertiser and mixed-role accounts.
  IF NOT public.has_role(auth.uid(), 'job_seeker'::public.app_role)
     OR public.has_role(auth.uid(), 'employer'::public.app_role)
     OR public.has_role(auth.uid(), 'staff'::public.app_role)
     OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
     OR public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'advertiser'::public.app_role) THEN
    RAISE EXCEPTION 'Freelancer account required' USING ERRCODE = '42501';
  END IF;

  -- KYC must be approved before any funds are moved to the pending reserve.
  IF NOT EXISTS (
    SELECT 1
    FROM public.kyc_verifications k
    WHERE k.user_id = auth.uid()
      AND k.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Complete identity verification before requesting a withdrawal';
  END IF;

  SELECT *
    INTO s
    FROM public.application_settings
    WHERE singleton = true;

  IF NOT FOUND
     OR s.min_withdrawal_cents IS NULL OR s.min_withdrawal_cents <= 0
     OR s.withdrawal_unit_cents IS NULL OR s.withdrawal_unit_cents <= 0
     OR s.fee_bps_per_unit IS NULL
     OR s.fee_bps_per_unit < 0
     OR s.fee_bps_per_unit > 10000 THEN
    RAISE EXCEPTION 'Withdrawal settings are invalid';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;
  IF _amount_cents < s.min_withdrawal_cents THEN
    RAISE EXCEPTION 'Below minimum withdrawal';
  END IF;
  IF _amount_cents % s.withdrawal_unit_cents <> 0 THEN
    RAISE EXCEPTION 'Amount must be a multiple';
  END IF;

  SELECT *
    INTO w
    FROM public.wallets
    WHERE user_id = auth.uid()
    FOR UPDATE;

  IF NOT FOUND OR w.available_cents < _amount_cents THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Keep intermediate arithmetic numeric to avoid integer overflow when
  -- multiplying unit count by cents and fee basis points.
  fee := floor(
    floor(_amount_cents::numeric / s.withdrawal_unit_cents)
    * s.withdrawal_unit_cents
    * s.fee_bps_per_unit / 10000
  )::integer;
  IF fee < 0 OR fee >= _amount_cents THEN
    RAISE EXCEPTION 'Withdrawal fee settings produce an invalid net payout';
  END IF;
  net := _amount_cents - fee;

  UPDATE public.wallets
    SET available_cents = available_cents - _amount_cents,
        pending_withdrawal_cents = pending_withdrawal_cents + _amount_cents
    WHERE id = w.id;

  INSERT INTO public.withdrawal_requests(
    user_id, method, destination, amount_cents, fee_cents, net_cents
  )
  VALUES (
    auth.uid(), _method, COALESCE(_destination, '{}'::jsonb),
    _amount_cents, fee, net
  )
  RETURNING id INTO wid;

  INSERT INTO public.notifications(user_id, type, title, body, link)
  VALUES (
    auth.uid(), 'withdrawal_requested', 'Withdrawal received',
    'Your request for $' || to_char(net / 100.0, 'FM999999999.00')
      || ' will be processed within 48 hours.',
    '/withdrawals'
  );

  INSERT INTO public.notifications(user_id, type, title, body, link)
  SELECT ur.user_id, 'withdrawal_requested'::public.notification_type,
         'New withdrawal request',
         'A user requested $' || to_char(_amount_cents / 100.0, 'FM999999999.00') || '.',
         '/admin/withdrawals'
  FROM public.user_roles ur
  WHERE ur.role IN ('super_admin', 'admin')
  UNION
  SELECT sp.user_id, 'withdrawal_requested'::public.notification_type,
         'New withdrawal request',
         'A user requested $' || to_char(_amount_cents / 100.0, 'FM999999999.00') || '.',
         '/admin/withdrawals'
  FROM public.staff_permissions sp
  WHERE sp.permission = 'approve_withdrawals';

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (
    auth.uid(), 'request_withdrawal', 'withdrawal_requests', wid,
    jsonb_build_object('amount_cents', _amount_cents, 'fee_cents', fee, 'net_cents', net)
  );

  RETURN wid;
END;
$$;

-- Keep the two-argument signature used by older clients, but route it through
-- the current three-argument implementation which locks the request and
-- releases the reserve exactly once. Its staff authorization check remains
-- inside the delegated function.
CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.reject_withdrawal(_id, _reason, false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(integer, public.withdrawal_method, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, public.withdrawal_method, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
