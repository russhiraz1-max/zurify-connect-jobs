-- Job listing evolution: richer metadata on tasks + categories
DO $$ BEGIN
  CREATE TYPE public.job_type AS ENUM ('micro_task','freelance_project','gig','remote_job','service_request','contest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.experience_level AS ENUM ('entry','intermediate','expert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_difficulty AS ENUM ('easy','medium','hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS job_type public.job_type NOT NULL DEFAULT 'micro_task',
  ADD COLUMN IF NOT EXISTS experience_level public.experience_level NOT NULL DEFAULT 'entry',
  ADD COLUMN IF NOT EXISTS difficulty public.job_difficulty NOT NULL DEFAULT 'easy',
  ADD COLUMN IF NOT EXISTS skills text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_remote boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.task_categories
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS tasks_job_type_idx ON public.tasks (job_type);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON public.tasks (status);

-- Public counts of published jobs per category (safe aggregate, no row exposure)
CREATE OR REPLACE FUNCTION public.get_job_categories()
RETURNS TABLE(id uuid, name text, slug text, icon text, description text, color text, sort_order integer, job_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.slug, c.icon, c.description, c.color, c.sort_order,
         count(t.id) FILTER (WHERE t.status = 'published')
  FROM public.task_categories c
  LEFT JOIN public.tasks t ON t.category_id = c.id
  WHERE c.active
  GROUP BY c.id
  ORDER BY c.sort_order, c.name
$$;
GRANT EXECUTE ON FUNCTION public.get_job_categories() TO anon, authenticated;

-- Seed professional marketplace categories (idempotent by slug)
INSERT INTO public.task_categories (name, slug, icon, description, color, sort_order) VALUES
  ('Micro Tasks','micro-tasks','Zap','Quick jobs you can finish in minutes.','amber',1),
  ('Writing','writing','PenLine','Articles, blogs, copywriting and editing.','blue',2),
  ('Content Creation','content-creation','Sparkles','Content for blogs, brands and social platforms.','violet',3),
  ('Graphic Design','graphic-design','Palette','Visual design work of every kind.','pink',4),
  ('Logo Design','logo-design','Hexagon','Brand marks, logos and identity.','rose',5),
  ('UI/UX Design','ui-ux-design','LayoutDashboard','Product, app and website interface design.','indigo',6),
  ('Programming','programming','Code','General coding and scripting work.','cyan',7),
  ('Web Development','web-development','Globe','Websites, web apps and integrations.','sky',8),
  ('Mobile Development','mobile-development','Smartphone','iOS, Android and cross-platform apps.','teal',9),
  ('Software Development','software-development','Terminal','Systems, tooling and backend engineering.','slate',10),
  ('Data Entry','data-entry','Table','Data capture, cleanup and processing.','emerald',11),
  ('Translation','translation','Languages','Translation, transcription and localisation.','lime',12),
  ('Marketing','marketing','Megaphone','Campaigns, growth and promotion.','orange',13),
  ('SEO','seo','Search','Search optimisation and content ranking.','green',14),
  ('Social Media','social-media','Share2','Community, posting and engagement.','fuchsia',15),
  ('Video Editing','video-editing','Video','Editing, motion and post-production.','red',16),
  ('Animation','animation','Film','2D, 3D and motion graphics.','purple',17),
  ('AI Services','ai-services','Bot','Prompting, AI workflows and automation.','violet',18),
  ('Virtual Assistant','virtual-assistant','Headset','Admin, scheduling and remote support.','blue',19),
  ('Customer Support','customer-support','LifeBuoy','Support, chat and helpdesk work.','cyan',20),
  ('Testing','testing','Bug','QA, app testing and feedback.','yellow',21),
  ('Engineering','engineering','Cog','Technical and engineering services.','stone',22),
  ('Research','research','BookOpen','Market, academic and product research.','indigo',23),
  ('Finance','finance','Wallet','Bookkeeping, analysis and finance tasks.','emerald',24),
  ('Education','education','GraduationCap','Tutoring, courses and training.','sky',25),
  ('Business','business','Briefcase','Consulting, operations and strategy.','slate',26),
  ('Other','other','MoreHorizontal','Anything that does not fit elsewhere.','gray',99)
ON CONFLICT (slug) DO UPDATE
  SET description = COALESCE(public.task_categories.description, EXCLUDED.description),
      icon = COALESCE(public.task_categories.icon, EXCLUDED.icon);