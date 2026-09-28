-- RCKT: correct can_access_task() and restore RLS policies affected by DROP FUNCTION CASCADE

CREATE OR REPLACE FUNCTION public.can_access_task(_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = _task_id
      AND (
        t.assigned_to = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1
          FROM public.task_assignees ta
          WHERE ta.task_id = t.id
            AND ta.user_id = auth.uid()
        )
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_task(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_task(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_update ON public.tasks;

CREATE POLICY tasks_select
ON public.tasks
FOR SELECT
TO authenticated
USING (public.can_access_task(id));

CREATE POLICY tasks_update
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.can_access_task(id))
WITH CHECK (public.can_access_task(id));

DROP POLICY IF EXISTS attachments_select ON public.task_attachments;
DROP POLICY IF EXISTS attachments_insert ON public.task_attachments;
DROP POLICY IF EXISTS attachments_delete ON public.task_attachments;

CREATE POLICY attachments_select
ON public.task_attachments
FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

CREATE POLICY attachments_insert
ON public.task_attachments
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_task(task_id));

CREATE POLICY attachments_delete
ON public.task_attachments
FOR DELETE
TO authenticated
USING (public.can_access_task(task_id));

DROP POLICY IF EXISTS task_files_select ON storage.objects;
DROP POLICY IF EXISTS task_files_insert ON storage.objects;
DROP POLICY IF EXISTS task_files_delete ON storage.objects;

CREATE POLICY task_files_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.can_access_task(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY task_files_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND public.can_access_task(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY task_files_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND public.can_access_task(((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS comments_select ON public.task_comments;
DROP POLICY IF EXISTS comments_insert ON public.task_comments;

CREATE POLICY comments_select
ON public.task_comments
FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

CREATE POLICY comments_insert
ON public.task_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND public.can_access_task(task_id)
);

DROP POLICY IF EXISTS steps_select ON public.task_steps;
DROP POLICY IF EXISTS steps_insert_assignee ON public.task_steps;
DROP POLICY IF EXISTS task_steps_insert ON public.task_steps;

CREATE POLICY steps_select
ON public.task_steps
FOR SELECT
TO authenticated
USING (public.can_access_task(task_id));

CREATE POLICY steps_insert
ON public.task_steps
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND public.can_access_task(task_id)
);

DROP POLICY IF EXISTS reactions_select ON public.comment_reactions;
DROP POLICY IF EXISTS reactions_insert ON public.comment_reactions;

CREATE POLICY reactions_select
ON public.comment_reactions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.task_comments c
  WHERE c.id = comment_reactions.comment_id
    AND public.can_access_task(c.task_id)
));

CREATE POLICY reactions_insert
ON public.comment_reactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.task_comments c
    WHERE c.id = comment_reactions.comment_id
      AND public.can_access_task(c.task_id)
  )
);

-- Sync task_assignees when assigned_to changes
CREATE OR REPLACE FUNCTION public.sync_task_assignees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.task_assignees (task_id, user_id, is_primary)
      VALUES (NEW.id, NEW.assigned_to, true)
      ON CONFLICT (task_id, user_id) DO UPDATE
      SET is_primary = true;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    DELETE FROM public.task_assignees
    WHERE task_id = NEW.id
      AND user_id = OLD.assigned_to;

    UPDATE public.task_assignees
    SET is_primary = false
    WHERE task_id = NEW.id
      AND is_primary = true;

    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.task_assignees (task_id, user_id, is_primary)
      VALUES (NEW.id, NEW.assigned_to, true)
      ON CONFLICT (task_id, user_id) DO UPDATE
      SET is_primary = true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_assignees ON public.tasks;

CREATE TRIGGER trg_sync_task_assignees
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_assignees();

-- Backfill: unmark primaries that don't match assigned_to, ensure every assigned_to is primary
UPDATE public.task_assignees ta
SET is_primary = false
WHERE ta.is_primary = true
  AND EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = ta.task_id
      AND t.assigned_to <> ta.user_id
  );

INSERT INTO public.task_assignees (task_id, user_id, is_primary)
SELECT t.id, t.assigned_to, true
FROM public.tasks t
WHERE t.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.task_assignees ta
    WHERE ta.task_id = t.id
      AND ta.user_id = t.assigned_to
      AND ta.is_primary = true
  )
ON CONFLICT (task_id, user_id) DO UPDATE
SET is_primary = true;

-- Secure RPC for team member avatars
DROP FUNCTION IF EXISTS public.get_team_member_avatar(uuid);

CREATE FUNCTION public.get_team_member_avatar(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.avatar_path
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = _user_id
    AND p.is_active = true
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_member_avatar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_member_avatar(uuid) TO authenticated;