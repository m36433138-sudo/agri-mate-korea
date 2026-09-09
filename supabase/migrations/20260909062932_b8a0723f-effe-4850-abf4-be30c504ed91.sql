CREATE POLICY "staff read chat files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-files' AND public.is_staff(auth.uid()));

CREATE POLICY "staff upload chat files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-files' AND public.is_staff(auth.uid()) AND owner = auth.uid());

CREATE POLICY "owner delete chat files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-files' AND owner = auth.uid());