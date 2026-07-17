
DROP TABLE IF EXISTS public.applications CASCADE;
DROP TABLE IF EXISTS public.jobs CASCADE;

DO $$ BEGIN CREATE TYPE public.task_status AS ENUM ('draft','published','paused','archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.submission_status AS ENUM ('pending','approved','rejected','resubmit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.withdrawal_status AS ENUM ('pending','approved','rejected','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.withdrawal_method AS ENUM ('paypal','manual'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tx_type AS ENUM ('earning','withdrawal','fee','adjustment','refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_type AS ENUM ('account_verified','task_approved','task_rejected','task_resubmit','withdrawal_approved','withdrawal_rejected','featured_task','system','announcement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.report_status AS ENUM ('open','investigating','resolved','dismissed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open','pending','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.staff_permission AS ENUM ('review_submissions','review_reports','reply_tickets','view_users','view_tasks','view_withdrawals','approve_withdrawals'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;

CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.staff_permission NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);
GRANT SELECT ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.application_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  super_admin_email text NOT NULL DEFAULT 'russhiraz565@gmail.com',
  staff_bootstrap_email text DEFAULT 'oblockrus565@gmail.com',
  min_withdrawal_cents integer NOT NULL DEFAULT 300,
  withdrawal_unit_cents integer NOT NULL DEFAULT 300,
  fee_bps_per_unit integer NOT NULL DEFAULT 1000,
  paypal_instructions text DEFAULT 'Payments processed manually within 48 hours.',
  site_name text NOT NULL DEFAULT 'Zurify',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_settings TO authenticated, anon;
GRANT UPDATE ON public.application_settings TO authenticated;
GRANT ALL ON public.application_settings TO service_role;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.application_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role='super_admin')
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role IN ('staff','super_admin'))
$$;
CREATE OR REPLACE FUNCTION public.has_staff_permission(_uid uuid, _perm public.staff_permission)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_super_admin(_uid)
      OR EXISTS (SELECT 1 FROM public.staff_permissions WHERE user_id=_uid AND permission=_perm)
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_staff_permission(uuid, public.staff_permission) TO anon, authenticated;

CREATE POLICY "settings readable" ON public.application_settings FOR SELECT USING (true);
CREATE POLICY "super admin updates settings" ON public.application_settings FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER application_settings_updated BEFORE UPDATE ON public.application_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "user reads own perms" ON public.staff_permissions FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manages perms" ON public.staff_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin manages roles" ON public.user_roles;
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, icon text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.task_categories TO anon, authenticated;
GRANT ALL ON public.task_categories TO service_role;
ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.task_categories FOR SELECT USING (true);
CREATE POLICY "super admin writes categories" ON public.task_categories FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
INSERT INTO public.task_categories (name,slug,icon,sort_order) VALUES
  ('Social Media','social-media','share-2',1),
  ('Surveys','surveys','clipboard-list',2),
  ('App Testing','app-testing','smartphone',3),
  ('Reviews','reviews','star',4),
  ('Signup Offers','signup-offers','user-plus',5),
  ('Other','other','sparkles',6)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, description text NOT NULL, instructions text NOT NULL,
  proof_requirements text,
  category_id uuid REFERENCES public.task_categories(id) ON DELETE SET NULL,
  reward_cents integer NOT NULL CHECK (reward_cents>=0),
  max_per_user integer NOT NULL DEFAULT 1 CHECK (max_per_user>=1),
  max_total integer,
  starts_at timestamptz, ends_at timestamptz, est_minutes integer,
  status public.task_status NOT NULL DEFAULT 'draft',
  featured boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_status_idx ON public.tasks(status);
CREATE INDEX tasks_featured_idx ON public.tasks(featured);
GRANT SELECT ON public.tasks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks public read published" ON public.tasks FOR SELECT USING (status='published' OR public.is_staff(auth.uid()));
CREATE POLICY "super admin writes tasks" ON public.tasks FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_cents integer NOT NULL DEFAULT 0 CHECK (available_cents>=0),
  pending_cents integer NOT NULL DEFAULT 0 CHECK (pending_cents>=0),
  lifetime_earned_cents integer NOT NULL DEFAULT 0,
  lifetime_withdrawn_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_super_admin(auth.uid()));
CREATE TRIGGER wallets_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.tx_type NOT NULL,
  amount_cents integer NOT NULL, balance_after_cents integer NOT NULL,
  reference_type text, reference_id uuid, memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_tx_user_idx ON public.wallet_transactions(user_id, created_at DESC);
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own tx" ON public.wallet_transactions FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_super_admin(auth.uid()));

CREATE TABLE public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proof_text text, proof_url text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.submission_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes text, rejection_reason text, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX submissions_user_idx ON public.task_submissions(user_id, created_at DESC);
CREATE INDEX submissions_status_idx ON public.task_submissions(status);
GRANT SELECT ON public.task_submissions TO authenticated;
GRANT ALL ON public.task_submissions TO service_role;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own submissions" ON public.task_submissions FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.has_staff_permission(auth.uid(),'review_submissions'));
CREATE TRIGGER submissions_updated BEFORE UPDATE ON public.task_submissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method public.withdrawal_method NOT NULL DEFAULT 'paypal',
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  amount_cents integer NOT NULL CHECK (amount_cents>0),
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL,
  status public.withdrawal_status NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason text, processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX withdrawals_user_idx ON public.withdrawal_requests(user_id, created_at DESC);
CREATE INDEX withdrawals_status_idx ON public.withdrawal_requests(status);
GRANT SELECT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.has_staff_permission(auth.uid(),'view_withdrawals'));
CREATE TRIGGER withdrawals_updated BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL, body text, link text, read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "user updates own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL, body text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements public read" ON public.announcements FOR SELECT USING (published_at IS NOT NULL OR public.is_staff(auth.uid()));
CREATE POLICY "super admin writes announcements" ON public.announcements FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL, target_id uuid,
  reason text NOT NULL, details text,
  status public.report_status NOT NULL DEFAULT 'open',
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handler_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own reports" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id=auth.uid() OR public.has_staff_permission(auth.uid(),'review_reports'));
CREATE POLICY "user creates report" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id=auth.uid());
CREATE TRIGGER reports_updated BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket owner or staff read" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.has_staff_permission(auth.uid(),'reply_tickets'));
CREATE POLICY "user creates ticket" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL, is_staff_reply boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ticket messages read" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.has_staff_permission(auth.uid(),'reply_tickets'))));
CREATE POLICY "ticket messages insert" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (author_id=auth.uid() AND EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.id=ticket_id AND (t.user_id=auth.uid() OR public.has_staff_permission(auth.uid(),'reply_tickets'))));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, target_type text, target_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_created_idx ON public.audit_logs(created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD; assigned public.app_role := 'user';
BEGIN
  SELECT * INTO s FROM public.application_settings WHERE singleton=true LIMIT 1;
  INSERT INTO public.profiles (id, full_name, avatar_url) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  IF s.super_admin_email IS NOT NULL AND lower(NEW.email)=lower(s.super_admin_email) THEN
    assigned := 'super_admin';
  ELSIF s.staff_bootstrap_email IS NOT NULL AND lower(NEW.email)=lower(s.staff_bootstrap_email) THEN
    assigned := 'staff';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned) ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.wallets (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) SELECT u.id, 'super_admin'::public.app_role FROM auth.users u WHERE lower(u.email)='russhiraz565@gmail.com' ON CONFLICT (user_id, role) DO NOTHING;
INSERT INTO public.user_roles (user_id, role) SELECT u.id, 'staff'::public.app_role FROM auth.users u WHERE lower(u.email)='oblockrus565@gmail.com' ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_task(_task_id uuid, _proof_text text, _proof_url text, _attachments jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t RECORD; my_count integer; total_count integer; sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=_task_id AND status='published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not available'; END IF;
  IF t.starts_at IS NOT NULL AND now()<t.starts_at THEN RAISE EXCEPTION 'Task not started yet'; END IF;
  IF t.ends_at IS NOT NULL AND now()>t.ends_at THEN RAISE EXCEPTION 'Task ended'; END IF;
  SELECT count(*) INTO my_count FROM public.task_submissions WHERE task_id=_task_id AND user_id=auth.uid() AND status IN ('pending','approved');
  IF my_count>=t.max_per_user THEN RAISE EXCEPTION 'Submission limit reached for this task'; END IF;
  IF t.max_total IS NOT NULL THEN
    SELECT count(*) INTO total_count FROM public.task_submissions WHERE task_id=_task_id AND status IN ('pending','approved');
    IF total_count>=t.max_total THEN RAISE EXCEPTION 'Task fully claimed'; END IF;
  END IF;
  INSERT INTO public.task_submissions (task_id,user_id,proof_text,proof_url,attachments)
    VALUES (_task_id,auth.uid(),_proof_text,_proof_url,COALESCE(_attachments,'[]'::jsonb)) RETURNING id INTO sub_id;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'submit_task','task_submissions',sub_id,jsonb_build_object('task_id',_task_id));
  RETURN sub_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.submit_task(uuid,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_submission(_submission_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD; t RECORD; w RECORD; new_bal integer;
BEGIN
  IF NOT public.has_staff_permission(auth.uid(),'review_submissions') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.task_submissions WHERE id=_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF s.status NOT IN ('pending','resubmit') THEN RAISE EXCEPTION 'Only pending submissions can be approved'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=s.task_id;
  SELECT * INTO w FROM public.wallets WHERE user_id=s.user_id FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.wallets(user_id) VALUES (s.user_id) RETURNING * INTO w; END IF;
  new_bal := w.available_cents + t.reward_cents;
  UPDATE public.wallets SET available_cents=new_bal, lifetime_earned_cents=lifetime_earned_cents+t.reward_cents WHERE id=w.id;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
    VALUES (w.id,s.user_id,'earning',t.reward_cents,new_bal,'task_submission',s.id,'Reward for: '||t.title);
  UPDATE public.task_submissions SET status='approved',reviewer_id=auth.uid(),review_notes=_notes,reviewed_at=now() WHERE id=s.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (s.user_id,'task_approved','Task approved','Your submission for "'||t.title||'" was approved.','/submissions');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'approve_submission','task_submissions',s.id,jsonb_build_object('reward_cents',t.reward_cents));
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_submission(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_submission(_submission_id uuid, _reason text, _allow_resubmit boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD; t RECORD; new_status public.submission_status;
BEGIN
  IF NOT public.has_staff_permission(auth.uid(),'review_submissions') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.task_submissions WHERE id=_submission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  SELECT * INTO t FROM public.tasks WHERE id=s.task_id;
  new_status := CASE WHEN _allow_resubmit THEN 'resubmit'::public.submission_status ELSE 'rejected'::public.submission_status END;
  UPDATE public.task_submissions SET status=new_status,reviewer_id=auth.uid(),rejection_reason=_reason,reviewed_at=now() WHERE id=s.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (s.user_id, CASE WHEN _allow_resubmit THEN 'task_resubmit'::public.notification_type ELSE 'task_rejected'::public.notification_type END,
      CASE WHEN _allow_resubmit THEN 'Resubmission requested' ELSE 'Task rejected' END,
      'Submission for "'||t.title||'": '||COALESCE(_reason,''), '/submissions');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'reject_submission','task_submissions',s.id,jsonb_build_object('reason',_reason,'resubmit',_allow_resubmit));
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_submission(uuid,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.quote_withdrawal_fee(_amount_cents integer)
RETURNS TABLE(fee_cents integer, net_cents integer, unit_cents integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    (floor(_amount_cents::numeric/s.withdrawal_unit_cents)::integer * s.withdrawal_unit_cents * s.fee_bps_per_unit / 10000)::integer,
    (_amount_cents - (floor(_amount_cents::numeric/s.withdrawal_unit_cents)::integer * s.withdrawal_unit_cents * s.fee_bps_per_unit / 10000)::integer),
    s.withdrawal_unit_cents
  FROM public.application_settings s WHERE s.singleton=true LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.quote_withdrawal_fee(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount_cents integer, _method public.withdrawal_method, _destination jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s RECORD; w RECORD; fee integer; net integer; wid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO s FROM public.application_settings WHERE singleton=true;
  IF _amount_cents < s.min_withdrawal_cents THEN RAISE EXCEPTION 'Below minimum withdrawal'; END IF;
  IF _amount_cents % s.withdrawal_unit_cents <> 0 THEN RAISE EXCEPTION 'Amount must be a multiple'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.available_cents < _amount_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  fee := (floor(_amount_cents::numeric/s.withdrawal_unit_cents)::integer * s.withdrawal_unit_cents * s.fee_bps_per_unit / 10000)::integer;
  net := _amount_cents - fee;
  INSERT INTO public.withdrawal_requests(user_id,method,destination,amount_cents,fee_cents,net_cents)
    VALUES (auth.uid(),_method,COALESCE(_destination,'{}'::jsonb),_amount_cents,fee,net) RETURNING id INTO wid;
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'request_withdrawal','withdrawal_requests',wid,jsonb_build_object('amount_cents',_amount_cents));
  RETURN wid;
END; $$;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, public.withdrawal_method, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD; w RECORD; new_bal integer;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id=r.user_id FOR UPDATE;
  IF w.available_cents < r.amount_cents THEN RAISE EXCEPTION 'User has insufficient balance'; END IF;
  new_bal := w.available_cents - r.amount_cents;
  UPDATE public.wallets SET available_cents=new_bal, lifetime_withdrawn_cents=lifetime_withdrawn_cents+r.amount_cents WHERE id=w.id;
  INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
    VALUES (w.id,r.user_id,'withdrawal',-r.amount_cents,new_bal,'withdrawal_requests',r.id,'Withdrawal approved');
  IF r.fee_cents>0 THEN
    INSERT INTO public.wallet_transactions(wallet_id,user_id,type,amount_cents,balance_after_cents,reference_type,reference_id,memo)
      VALUES (w.id,r.user_id,'fee',-r.fee_cents,new_bal,'withdrawal_requests',r.id,'Withdrawal service fee');
  END IF;
  UPDATE public.withdrawal_requests SET status='approved',reviewer_id=auth.uid(),processed_at=now() WHERE id=r.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'withdrawal_approved','Withdrawal approved','Payment of $'||to_char(r.net_cents/100.0,'FM999999999.00')||' will be sent within 48 hours.','/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'approve_withdrawal','withdrawal_requests',r.id,jsonb_build_object('amount_cents',r.amount_cents,'fee_cents',r.fee_cents));
END; $$;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_staff_permission(auth.uid(),'approve_withdrawals')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  UPDATE public.withdrawal_requests SET status='rejected',reviewer_id=auth.uid(),rejection_reason=_reason,processed_at=now() WHERE id=r.id;
  INSERT INTO public.notifications(user_id,type,title,body,link)
    VALUES (r.user_id,'withdrawal_rejected','Withdrawal rejected',COALESCE(_reason,'Withdrawal rejected.'),'/withdrawals');
  INSERT INTO public.audit_logs(actor_id,action,target_type,target_id,meta)
    VALUES (auth.uid(),'reject_withdrawal','withdrawal_requests',r.id,jsonb_build_object('reason',_reason));
END; $$;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid,text) TO authenticated;
