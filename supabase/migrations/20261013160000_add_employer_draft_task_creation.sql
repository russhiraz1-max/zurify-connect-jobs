-- Zurify 2.0: let approved client-role accounts create draft tasks for review.
-- Clients cannot publish, feature, prioritize, or directly edit other users' tasks.
-- Apply and test only in a disposable 2.0 database before production use.

DROP POLICY IF EXISTS "employers read own tasks" ON public.tasks;
CREATE POLICY "employers read own tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    AND public.has_role(auth.uid(), 'employer'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.create_client_task(
  _title text,
  _description text,
  _instructions text,
  _reward_cents integer,
  _category_id uuid DEFAULT NULL,
  _est_minutes integer DEFAULT NULL,
  _max_total integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_task_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'employer'::public.app_role)
     OR public.has_role(auth.uid(), 'job_seeker'::public.app_role) THEN
    RAISE EXCEPTION 'Client-only account required' USING ERRCODE = '42501';
  END IF;

  IF public.is_suspended(auth.uid()) THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  IF _title IS NULL OR length(btrim(_title)) < 4 OR length(_title) > 120 THEN
    RAISE EXCEPTION 'Title must be between 4 and 120 characters';
  END IF;
  IF _description IS NULL OR length(btrim(_description)) < 20 OR length(_description) > 3000 THEN
    RAISE EXCEPTION 'Description must be between 20 and 3000 characters';
  END IF;
  IF _instructions IS NULL OR length(btrim(_instructions)) < 10 OR length(_instructions) > 5000 THEN
    RAISE EXCEPTION 'Instructions must be between 10 and 5000 characters';
  END IF;
  IF _reward_cents IS NULL OR _reward_cents < 1 OR _reward_cents > 100000000 THEN
    RAISE EXCEPTION 'Reward must be between $0.01 and $1,000,000.00';
  END IF;
  IF _est_minutes IS NOT NULL AND (_est_minutes < 1 OR _est_minutes > 1440) THEN
    RAISE EXCEPTION 'Estimated time must be between 1 and 1440 minutes';
  END IF;
  IF _max_total IS NOT NULL AND (_max_total < 1 OR _max_total > 100000) THEN
    RAISE EXCEPTION 'Task capacity must be between 1 and 100000';
  END IF;

  IF _category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.task_categories c WHERE c.id = _category_id AND c.active = true
  ) THEN
    RAISE EXCEPTION 'Choose an active task category';
  END IF;

  INSERT INTO public.tasks (
    title, description, instructions, category_id, reward_cents,
    max_per_user, max_total, est_minutes, status, featured, priority, created_by
  )
  VALUES (
    btrim(_title), btrim(_description), btrim(_instructions), _category_id,
    _reward_cents, 1, _max_total, _est_minutes, 'draft', false, 0, auth.uid()
  )
  RETURNING id INTO new_task_id;

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, meta)
  VALUES (
    auth.uid(), 'create_client_task', 'tasks', new_task_id,
    jsonb_build_object(
      'status', 'draft',
      'reward_cents', _reward_cents,
      'category_id', _category_id,
      'max_total', _max_total
    )
  );

  RETURN new_task_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_client_task(text, text, text, integer, uuid, integer, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_task(text, text, text, integer, uuid, integer, integer)
  TO authenticated;
