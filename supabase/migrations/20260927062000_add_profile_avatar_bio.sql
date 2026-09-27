-- ============================================================
-- RCKT Task Center - Add avatar and bio to user profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '';

-- ============================================================
-- Profile avatars storage bucket (private)
-- ============================================================

INSERT INTO storage.buckets (
  id,
  name,
  public
)
VALUES (
  'profile-avatars',
  'profile-avatars',
  false
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false;

-- ============================================================
-- Storage policies for profile-avatars bucket
-- ============================================================

DO $$
BEGIN

  -- Authenticated users can SELECT (view) all avatars
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_avatars_select'
  ) THEN
    CREATE POLICY profile_avatars_select
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'profile-avatars');
  END IF;

  -- Users can INSERT (upload) only in their own folder
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_avatars_insert'
  ) THEN
    CREATE POLICY profile_avatars_insert
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'profile-avatars'
      AND (auth.uid())::text = (string_to_array(name, '/'))[1]
    );
  END IF;

  -- Users can UPDATE their own avatars
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_avatars_update'
  ) THEN
    CREATE POLICY profile_avatars_update
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'profile-avatars'
      AND (auth.uid())::text = (string_to_array(name, '/'))[1]
    )
    WITH CHECK (
      bucket_id = 'profile-avatars'
      AND (auth.uid())::text = (string_to_array(name, '/'))[1]
    );
  END IF;

  -- Users can DELETE their own avatars
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_avatars_delete'
  ) THEN
    CREATE POLICY profile_avatars_delete
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'profile-avatars'
      AND (auth.uid())::text = (string_to_array(name, '/'))[1]
    );
  END IF;

  -- Admins can manage all avatars
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'profile_avatars_admin'
  ) THEN
    CREATE POLICY profile_avatars_admin
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (
      bucket_id = 'profile-avatars'
      AND public.has_role(auth.uid(), 'admin')
    )
    WITH CHECK (
      bucket_id = 'profile-avatars'
      AND public.has_role(auth.uid(), 'admin')
    );
  END IF;

END $$;
