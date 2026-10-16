-- Add a dedicated, non-privileged AI-company account class.
-- This migration only adds the enum value; the next migration uses it after
-- this migration has committed, avoiding unsafe enum-value use in one transaction.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ai_company';
