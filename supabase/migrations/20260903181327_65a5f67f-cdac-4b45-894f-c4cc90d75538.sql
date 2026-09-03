CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_comments_task_id_created_idx ON public.task_comments (task_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.task_comments
  FOR SELECT TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY "comments_insert" ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_access_task(task_id));

CREATE POLICY "comments_delete" ON public.task_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));