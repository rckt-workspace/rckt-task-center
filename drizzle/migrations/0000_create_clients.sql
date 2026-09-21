CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX clients_nombre_key ON public.clients (lower(nombre));

GRANT SELECT ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY clients_admin_all ON public.clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.clients TO authenticated;

INSERT INTO public.clients (nombre)
SELECT DISTINCT cliente FROM public.tasks WHERE cliente <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.clients (nombre) VALUES
  ('Voz Estratégica'),
  ('La Cuisine Appliances Colombia'),
  ('Grill Brothers'),
  ('Miel Dalí'),
  ('Magda - HEOR'),
  ('Newbody COL')
ON CONFLICT DO NOTHING;