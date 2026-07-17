
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='super_admin') THEN ALTER TYPE public.app_role ADD VALUE 'super_admin'; END IF; END$$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='staff') THEN ALTER TYPE public.app_role ADD VALUE 'staff'; END IF; END$$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='user') THEN ALTER TYPE public.app_role ADD VALUE 'user'; END IF; END$$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='app_role' AND e.enumlabel='advertiser') THEN ALTER TYPE public.app_role ADD VALUE 'advertiser'; END IF; END$$;
