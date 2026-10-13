-- Keep withdrawal ledger entries consistent with the amount actually paid:
-- payout = net_cents and fee = fee_cents, so the two entries sum to the gross
-- reserved amount (amount_cents). Preserve the existing KYC check, reserve
-- checks, row locks, referral processing and idempotent pending-status guard.
-- Test on an isolated database before use; do not rewrite historical transactions.

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD; w RECORD; new_bal integer; pending_requests_cents bigint;
        ru RECORD; ss RECORD; rc RECORD; owner_wallet RECORD; commission integer; ow_bal integer;
        eff_bps integer; eff_min integer;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kyc_verifications k WHERE k.user_id=r.user_id AND k.status='approved') THEN
    RAISE EXCEPTION 'User has not completed identity verification';
  END IF;
  IF r.amount_cents IS NULL OR r.net_cents IS NULL OR r.fee_cents IS NULL
     OR r.amount_cents <= 0 OR r.net_cents <= 0 OR r.fee_cents < 0
     OR r.net_cents + r.fee_cents <> r.amount_cents THEN
    RAISE EXCEPTION 'Withdrawal amount, fee and net payout do not reconcile';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE user_id=r.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;

  -- Reconcile the wallet aggregate against every pending request before paying
  -- one request; otherwise an unrelated reserve mismatch could be hidden.
  SELECT COALESCE(sum(amount_cents), 0)
    INTO pending_requests_cents
    FROM public.withdrawal_requests
    WHERE user_id = r.user_id AND status = 'pending';
  IF COALESCE(w.pending_withdrawal_cents, 0) <> pending_requests_cents
     OR pending_requests_cents < r.amount_cents THEN
    RAISE EXCEPTION 'Reserve mismatch; withdrawal requires reconciliation';
  END IF;

  UPDATE public.wallets SET pending_withdrawal_cents = pending_withdrawal_cents - r.amount_cents,
                             lifetime_withdrawn_cents = lifetime_withdrawn_cents + r.amount_cents
    WHERE id = w.id RETURNING available_cents INTO new_bal;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
    VALUES (w.id,r.user_id,'withdrawal',-r.net_cents,new_bal,'withdrawal_requests',r.id,'Withdrawal payout (net of service fee)');
  IF r.fee_cents>0 THEN
    INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
      VALUES (w.id,r.user_id,'fee',-r.fee_cents,new_bal,'withdrawal_requests',r.id,'Withdrawal service fee');
  END IF;
  UPDATE public.withdrawal_requests SET status='approved',reviewer_id=auth.uid(),processed_at=now() WHERE id=r.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'withdrawal_approved','Withdrawal approved',
      'Payment of $'||to_char(r.net_cents/100.0,'FM999999999.00')||' will arrive via PayPal within 48 hours.','/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'approve_withdrawal','withdrawal_requests',r.id,jsonb_build_object('amount_cents',r.amount_cents,'fee_cents',r.fee_cents));

  SELECT * INTO ru FROM public.referral_uses WHERE referred_user_id=r.user_id FOR UPDATE;
  IF FOUND AND (ru.commission_expires_at IS NULL OR now() <= ru.commission_expires_at) THEN
    SELECT * INTO ss FROM public.application_settings WHERE singleton=true;
    SELECT * INTO rc FROM public.referral_codes WHERE id=ru.code_id;
    eff_bps := COALESCE(rc.commission_bps, ss.referral_commission_bps);
    eff_min := COALESCE(rc.min_withdrawal_cents, ss.referral_min_withdrawal_cents);
    IF ss.referral_enabled AND eff_bps > 0 AND r.amount_cents >= eff_min THEN
      commission := floor(r.amount_cents::numeric * eff_bps / 10000)::integer;
      IF commission > 0 THEN
        SELECT * INTO owner_wallet FROM public.wallets WHERE user_id=ru.owner_user_id FOR UPDATE;
        IF NOT FOUND THEN INSERT INTO public.wallets(user_id) VALUES (ru.owner_user_id) RETURNING * INTO owner_wallet; END IF;
        ow_bal := owner_wallet.available_cents + commission;
        UPDATE public.wallets SET available_cents=ow_bal, lifetime_earned_cents=lifetime_earned_cents+commission WHERE id=owner_wallet.id;
        INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
          VALUES (owner_wallet.id,ru.owner_user_id,'referral_commission',commission,ow_bal,'withdrawal_requests',r.id,'Referral commission from a referred user withdrawal');
        UPDATE public.referral_uses SET total_commission_cents=total_commission_cents+commission WHERE id=ru.id;
        INSERT INTO public.notifications(user_id,type,title,body,link)
          VALUES (ru.owner_user_id,'referral_commission_earned','Referral commission credited',
            '$'||to_char(commission/100.0,'FM999999999.00')||' commission added from a referred user withdrawal.','/referrals');
        INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
          VALUES (auth.uid(),'referral_commission','referral_uses',ru.id,
            jsonb_build_object('owner',ru.owner_user_id,'from_user',r.user_id,'amount_cents',commission));
      END IF;
    END IF;
  END IF;
END; $$;
