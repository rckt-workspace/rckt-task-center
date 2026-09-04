CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  cliente text NOT NULL,
  area text NOT NULL,
  tarea text NOT NULL,
  observaciones text NOT NULL DEFAULT '',
  enlaces text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_admin_all ON public.task_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));