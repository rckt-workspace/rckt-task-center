CREATE TABLE public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.comment_reactions TO authenticated;
GRANT ALL ON public.comment_reactions TO service_role;

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON public.comment_reactions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.task_comments c
  WHERE c.id = comment_reactions.comment_id
    AND public.can_access_task(c.task_id)
));

CREATE POLICY "reactions_insert" ON public.comment_reactions
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.task_comments c
    WHERE c.id = comment_reactions.comment_id
      AND public.can_access_task(c.task_id)
  )
);

CREATE POLICY "reactions_delete" ON public.comment_reactions
FOR DELETE TO authenticated
USING (user_id = auth.uid());