ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS enlaces text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = _task_id
      AND (t.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
$$;

CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text NOT NULL,
  mime text NOT NULL DEFAULT '',
  size bigint NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_attachments_task_id_idx ON public.task_attachments(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select ON public.task_attachments FOR SELECT TO authenticated
  USING (public.can_access_task(task_id));
CREATE POLICY attachments_insert ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_task(task_id));
CREATE POLICY attachments_delete ON public.task_attachments FOR DELETE TO authenticated
  USING (public.can_access_task(task_id));

-- Storage: archivos en task-attachments/<task_id>/<archivo>
CREATE POLICY task_files_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND public.can_access_task(((storage.foldername(name))[1])::uuid));
CREATE POLICY task_files_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND public.can_access_task(((storage.foldername(name))[1])::uuid));
CREATE POLICY task_files_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments' AND public.can_access_task(((storage.foldername(name))[1])::uuid));