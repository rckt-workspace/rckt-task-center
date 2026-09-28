-- RLS policies for the profile-avatars bucket (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_select') THEN
    CREATE POLICY profile_avatars_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'profile-avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_insert') THEN
    CREATE POLICY profile_avatars_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'profile-avatars' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_update') THEN
    CREATE POLICY profile_avatars_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'profile-avatars' AND (auth.uid())::text = (string_to_array(name, '/'))[1])
    WITH CHECK (bucket_id = 'profile-avatars' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_delete') THEN
    CREATE POLICY profile_avatars_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'profile-avatars' AND (auth.uid())::text = (string_to_array(name, '/'))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'profile_avatars_admin') THEN
    CREATE POLICY profile_avatars_admin ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'profile-avatars' AND public.has_role(auth.uid(), 'admin'))
    WITH CHECK (bucket_id = 'profile-avatars' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;