-- ============================================================
-- RCKT Task Center - Ensure clients table
-- Safe for databases where clients already exists
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clients_nombre_key
ON public.clients (lower(nombre));

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.clients
TO authenticated;

GRANT ALL
ON public.clients
TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'clients_select'
  ) THEN

    CREATE POLICY clients_select
    ON public.clients
    FOR SELECT
    TO authenticated
    USING (true);

  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'clients'
      AND policyname = 'clients_admin_all'
  ) THEN

    CREATE POLICY clients_admin_all
    ON public.clients
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

  END IF;

END $$;