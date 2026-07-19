
DROP POLICY IF EXISTS "Users upload own proofs" ON storage.objects;
CREATE POLICY "Users upload own proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id='submission-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users read own proofs" ON storage.objects;
CREATE POLICY "Users read own proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id='submission-proofs' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_super_admin(auth.uid())
    OR public.has_staff_permission(auth.uid(),'review_submissions')
  ));

DROP POLICY IF EXISTS "Users delete own proofs" ON storage.objects;
CREATE POLICY "Users delete own proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id='submission-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
