-- ============================================================
-- RCKT Task Center - Team Directory, Projects, & Multi-Assignee
-- ============================================================

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_assignees_one_primary ON public.task_assignees(task_id) WHERE is_primary = true;

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;
GRANT ALL ON public.task_assignees TO service_role;

CREATE POLICY task_assignees_select
ON public.task_assignees
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY task_assignees_insert
ON public.task_assignees
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY task_assignees_update
ON public.task_assignees
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY task_assignees_delete
ON public.task_assignees
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Backfill from tasks.assigned_to
INSERT INTO public.task_assignees (task_id, user_id, is_primary, assigned_at)
SELECT id, assigned_to, true, created_at
FROM public.tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- ============================================================
-- RPC: get_team_directory()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_team_directory()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  cargo text,
  avatar_path text,
  bio text,
  role text,
  role_title text,
  role_summary text,
  specialties text[],
  responsibilities text[],
  strengths text[],
  typical_work text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.cargo,
    p.avatar_path,
    p.bio,
    ur.role,
    tmc.role_title,
    tmc.role_summary,
    tmc.specialties,
    tmc.responsibilities,
    tmc.strengths,
    tmc.typical_work
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON p.id = ur.user_id
  LEFT JOIN public.team_member_contexts tmc ON p.id = tmc.user_id
  WHERE p.is_active = true
  ORDER BY p.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_directory() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_team_directory() TO authenticated;

-- ============================================================
-- RPC: get_team_task_progress()
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_team_task_progress()
RETURNS TABLE (
  task_id uuid,
  cliente text,
  tarea text,
  estado text,
  fecha_limite text,
  semana text,
  primary_user_id uuid,
  primary_name text,
  assignee_ids uuid[],
  assignee_names text[],
  steps_total bigint,
  steps_done bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    t.id,
    t.cliente,
    t.tarea,
    t.estado,
    t.fecha_limite::text,
    t.semana,
    t.assigned_to,
    p_primary.full_name,
    ARRAY_AGG(DISTINCT ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL),
    ARRAY_AGG(DISTINCT p_assignees.full_name) FILTER (WHERE p_assignees.full_name IS NOT NULL),
    COUNT(DISTINCT ts.id)::bigint,
    COUNT(DISTINCT ts.id) FILTER (WHERE ts.done = true)::bigint
  FROM public.tasks t
  LEFT JOIN public.profiles p_primary ON t.assigned_to = p_primary.id
  LEFT JOIN public.task_assignees ta ON t.id = ta.task_id
  LEFT JOIN public.profiles p_assignees ON ta.user_id = p_assignees.id
  LEFT JOIN public.task_steps ts ON t.id = ts.task_id
  GROUP BY
    t.id,
    t.cliente,
    t.tarea,
    t.estado,
    t.fecha_limite,
    t.semana,
    t.assigned_to,
    p_primary.full_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_task_progress() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_team_task_progress() TO authenticated;