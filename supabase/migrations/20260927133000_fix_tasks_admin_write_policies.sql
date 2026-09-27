-- ============================================================
-- RCKT Task Center - Fix task access for INSERT RETURNING
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_task(task_id uuid)
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
      WHERE t.id = $1
        AND t.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_assignees ta
      WHERE ta.task_id = $1
        AND ta.user_id = auth.uid()
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_access_task(uuid)
TO authenticated, service_role;
