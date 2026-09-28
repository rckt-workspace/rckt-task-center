-- RCKT: final can_access_task() definition (admin OR primary OR task_assignees)

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = _task_id
        AND t.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = _task_id
        AND ta.user_id = auth.uid()
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_task(uuid)
TO authenticated, service_role;