
-- Roles enum + user_roles table
CREATE TYPE public.app_role AS ENUM ('job_seeker', 'employer', 'admin');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  headline TEXT,
  bio TEXT,
  location TEXT,
  avatar_url TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'job_seeker');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Jobs
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'Full-time',
  remote BOOLEAN NOT NULL DEFAULT false,
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  requirements TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jobs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active jobs viewable by all" ON public.jobs FOR SELECT USING (status = 'active' OR auth.uid() = employer_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Employers insert own jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = employer_id AND (public.has_role(auth.uid(), 'employer') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Employers update own jobs" ON public.jobs FOR UPDATE TO authenticated USING (auth.uid() = employer_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Employers delete own jobs" ON public.jobs FOR DELETE TO authenticated USING (auth.uid() = employer_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Applications
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_letter TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Applicants view own applications" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = applicant_id OR auth.uid() IN (SELECT employer_id FROM public.jobs WHERE id = job_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users apply as themselves" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Applicants update own" ON public.applications FOR UPDATE TO authenticated USING (auth.uid() = applicant_id);
CREATE POLICY "Applicants delete own" ON public.applications FOR DELETE TO authenticated USING (auth.uid() = applicant_id);

-- Seed jobs
INSERT INTO public.jobs (title, company, location, employment_type, remote, salary_min, salary_max, description, requirements, tags) VALUES
('Senior Frontend Engineer', 'Northwind Labs', 'San Francisco, CA', 'Full-time', true, 140000, 180000, 'Build delightful product experiences with React and TypeScript on our design systems team.', '5+ years React, TypeScript, design systems experience.', ARRAY['React','TypeScript','Remote']),
('Product Designer', 'Halcyon', 'New York, NY', 'Full-time', false, 110000, 150000, 'Own end-to-end design for our flagship analytics product. Collaborate with PMs and engineers.', 'Portfolio required. 4+ years product design.', ARRAY['Design','Figma','B2B']),
('Backend Engineer, Payments', 'Meridian Financial', 'Remote', 'Full-time', true, 150000, 200000, 'Design and scale our payments infrastructure processing billions in volume.', 'Go or Rust, distributed systems, payments background a plus.', ARRAY['Go','Rust','Fintech','Remote']),
('Data Scientist', 'Aster Health', 'Boston, MA', 'Full-time', true, 130000, 170000, 'Apply ML to healthcare claims data. Partner with clinicians and product.', 'PhD or MS in a quantitative field, Python, SQL.', ARRAY['Python','ML','Healthcare']),
('DevOps Engineer', 'Stellar Cloud', 'Austin, TX', 'Full-time', true, 125000, 165000, 'Own our Kubernetes and Terraform platform serving 50+ engineers.', '3+ years K8s, AWS, Terraform.', ARRAY['K8s','AWS','Terraform']),
('Marketing Manager', 'Bloom & Co', 'Los Angeles, CA', 'Full-time', false, 90000, 120000, 'Lead go-to-market for our next product launch.', 'B2C marketing, campaign management.', ARRAY['Marketing','B2C']),
('iOS Engineer', 'Loop Studios', 'Remote', 'Contract', true, 80, 140, 'Ship polished iOS features to millions of users. Swift/SwiftUI stack.', 'Swift, SwiftUI, 3+ years shipping apps.', ARRAY['iOS','Swift','Contract']),
('Customer Success Lead', 'Nimbus AI', 'Chicago, IL', 'Full-time', true, 95000, 130000, 'Own retention and expansion across our top enterprise accounts.', 'SaaS CS experience, technical fluency.', ARRAY['CS','SaaS','Enterprise']);
