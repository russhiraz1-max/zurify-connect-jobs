
DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.staff_permission ADD VALUE IF NOT EXISTS 'review_applications';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'application_approved';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'application_rejected';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'support_reply';
