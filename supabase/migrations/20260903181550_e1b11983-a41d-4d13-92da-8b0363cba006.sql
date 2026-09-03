CREATE TABLE public.task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_steps_task_id_idx ON public.task_steps (task_id, position, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_steps TO authenticated;
GRANT ALL ON public.task_steps TO service_role;

ALTER TABLE public.task_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "steps_select" ON public.task_steps
  FOR SELECT TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY "steps_insert_assignee" ON public.task_steps
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assigned_to = auth.uid())
  );

CREATE POLICY "steps_update_assignee" ON public.task_steps
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "steps_delete_assignee" ON public.task_steps
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER trg_task_steps_updated BEFORE UPDATE ON public.task_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();