ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;