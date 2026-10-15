-- Grantable staff permissions for the dedicated AI-company review queues.
-- Values are added in their own migration before any function references them.
ALTER TYPE public.staff_permission ADD VALUE IF NOT EXISTS 'review_ai_companies';
ALTER TYPE public.staff_permission ADD VALUE IF NOT EXISTS 'review_ai_projects';
