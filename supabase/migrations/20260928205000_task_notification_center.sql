-- ============================================================
-- RCKT Task Center - Persistent task notifications
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON public.notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

-- ------------------------------------------------------------
-- Internal helpers
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notification_actor_name(_actor_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(btrim(p.full_name), '')
      FROM public.profiles p
      WHERE p.id = _actor_id
    ),
    'Sistema'
  );
$$;

CREATE OR REPLACE FUNCTION public.insert_task_notification(
  _recipient_id uuid,
  _actor_id uuid,
  _task_id uuid,
  _type text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF _recipient_id IS NULL THEN
    RETURN;
  END IF;

  IF _actor_id IS NOT NULL AND _recipient_id = _actor_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _recipient_id
      AND COALESCE(p.is_active, true) = true
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    actor_id,
    task_id,
    type,
    title,
    message,
    metadata
  )
  VALUES (
    _recipient_id,
    _actor_id,
    _task_id,
    _type,
    _title,
    _message,
    COALESCE(_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_admins(
  _actor_id uuid,
  _task_id uuid,
  _type text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  FOR v_recipient IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin'::public.app_role
      AND COALESCE(p.is_active, true) = true
  LOOP
    PERFORM public.insert_task_notification(
      v_recipient,
      _actor_id,
      _task_id,
      _type,
      _title,
      _message,
      _metadata
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_assignees(
  _actor_id uuid,
  _task_id uuid,
  _type text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  FOR v_recipient IN
    SELECT DISTINCT recipients.user_id
    FROM (
      SELECT t.assigned_to AS user_id
      FROM public.tasks t
      WHERE t.id = _task_id

      UNION

      SELECT ta.user_id
      FROM public.task_assignees ta
      WHERE ta.task_id = _task_id
    ) recipients
    JOIN public.profiles p ON p.id = recipients.user_id
    WHERE COALESCE(p.is_active, true) = true
  LOOP
    PERFORM public.insert_task_notification(
      v_recipient,
      _actor_id,
      _task_id,
      _type,
      _title,
      _message,
      _metadata
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_task_audience(
  _actor_id uuid,
  _task_id uuid,
  _type text,
  _title text,
  _message text,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_recipient uuid;
BEGIN
  FOR v_recipient IN
    SELECT DISTINCT audience.user_id
    FROM (
      SELECT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role = 'admin'::public.app_role

      UNION

      SELECT t.assigned_to
      FROM public.tasks t
      WHERE t.id = _task_id

      UNION

      SELECT ta.user_id
      FROM public.task_assignees ta
      WHERE ta.task_id = _task_id
    ) audience
    JOIN public.profiles p ON p.id = audience.user_id
    WHERE COALESCE(p.is_active, true) = true
  LOOP
    PERFORM public.insert_task_notification(
      v_recipient,
      _actor_id,
      _task_id,
      _type,
      _title,
      _message,
      _metadata
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.notification_actor_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.insert_task_notification(uuid, uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_admins(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_assignees(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_audience(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- Tasks: assignment and updates
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notifications_on_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_actor_is_admin boolean := false;
  v_type text;
  v_title text;
  v_message text;
  v_fields text[] := ARRAY[]::text[];
BEGIN
  v_actor_name := public.notification_actor_name(v_actor);
  v_actor_is_admin := COALESCE(public.has_role(v_actor, 'admin'::public.app_role), false);

  IF TG_OP = 'INSERT' THEN
    v_type := 'task_created';
    v_title := 'Nueva tarea asignada';
    v_message := v_actor_name || ' te asignó "' || NEW.tarea || '".';

    PERFORM public.notify_task_assignees(
      v_actor,
      NEW.id,
      v_type,
      v_title,
      v_message,
      jsonb_build_object(
        'estado', NEW.estado,
        'fecha_limite', NEW.fecha_limite,
        'cliente', NEW.cliente
      )
    );

    RETURN NEW;
  END IF;

  IF NEW.tarea IS DISTINCT FROM OLD.tarea THEN
    v_fields := array_append(v_fields, 'tarea');
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_fields := array_append(v_fields, 'estado');
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    v_fields := array_append(v_fields, 'responsable');
  END IF;
  IF NEW.cliente IS DISTINCT FROM OLD.cliente THEN
    v_fields := array_append(v_fields, 'cliente');
  END IF;
  IF NEW.area IS DISTINCT FROM OLD.area THEN
    v_fields := array_append(v_fields, 'area');
  END IF;
  IF NEW.fecha_limite IS DISTINCT FROM OLD.fecha_limite THEN
    v_fields := array_append(v_fields, 'fecha_limite');
  END IF;
  IF NEW.hora_limite IS DISTINCT FROM OLD.hora_limite THEN
    v_fields := array_append(v_fields, 'hora_limite');
  END IF;
  IF NEW.fecha_entrega IS DISTINCT FROM OLD.fecha_entrega THEN
    v_fields := array_append(v_fields, 'fecha_entrega');
  END IF;
  IF NEW.observaciones IS DISTINCT FROM OLD.observaciones THEN
    v_fields := array_append(v_fields, 'observaciones');
  END IF;
  IF NEW.enlaces IS DISTINCT FROM OLD.enlaces THEN
    v_fields := array_append(v_fields, 'enlaces');
  END IF;
  IF NEW.semana IS DISTINCT FROM OLD.semana THEN
    v_fields := array_append(v_fields, 'semana');
  END IF;

  IF COALESCE(array_length(v_fields, 1), 0) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado = 'Completada' THEN
    v_type := 'task_completed';
    v_title := 'Tarea completada';
    v_message := v_actor_name || ' completó "' || NEW.tarea || '".';
  ELSIF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_type := 'task_status_changed';
    v_title := 'Estado actualizado';
    v_message := v_actor_name || ' cambió "' || NEW.tarea || '" de "' || OLD.estado || '" a "' || NEW.estado || '".';
  ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    v_type := 'task_reassigned';
    v_title := 'Tarea reasignada';
    v_message := v_actor_name || ' reasignó "' || NEW.tarea || '".';
  ELSE
    v_type := 'task_updated';
    v_title := 'Tarea actualizada';
    v_message := v_actor_name || ' actualizó "' || NEW.tarea || '".';
  END IF;

  IF v_actor_is_admin THEN
    PERFORM public.notify_task_assignees(
      v_actor,
      NEW.id,
      v_type,
      v_title,
      v_message,
      jsonb_build_object(
        'changed_fields', to_jsonb(v_fields),
        'old_estado', OLD.estado,
        'new_estado', NEW.estado
      )
    );
  ELSE
    PERFORM public.notify_task_admins(
      v_actor,
      NEW.id,
      v_type,
      v_title,
      v_message,
      jsonb_build_object(
        'changed_fields', to_jsonb(v_fields),
        'old_estado', OLD.estado,
        'new_estado', NEW.estado
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_task_change ON public.tasks;
CREATE TRIGGER trg_notifications_task_change
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notifications_on_task_change();

-- ------------------------------------------------------------
-- Comments: notify manager + task participants, excluding author
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notifications_on_comment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid := COALESCE(NEW.author_id, auth.uid());
  v_actor_name text;
  v_task_name text;
  v_preview text;
BEGIN
  v_actor_name := public.notification_actor_name(v_actor);

  SELECT t.tarea
  INTO v_task_name
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  v_preview := left(regexp_replace(NEW.body, E'[\\n\\r]+', ' ', 'g'), 120);

  PERFORM public.notify_task_audience(
    v_actor,
    NEW.task_id,
    'comment_added',
    'Nuevo comentario',
    v_actor_name || ' comentó en "' || COALESCE(v_task_name, 'una tarea') || '": ' || v_preview,
    jsonb_build_object('comment_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_comment_insert ON public.task_comments;
CREATE TRIGGER trg_notifications_comment_insert
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.notifications_on_comment_insert();

-- ------------------------------------------------------------
-- Attachments / voice notes
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notifications_on_attachment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_actor uuid := COALESCE(NEW.uploaded_by, auth.uid());
  v_actor_name text;
  v_task_name text;
  v_title text;
  v_type text;
BEGIN
  v_actor_name := public.notification_actor_name(v_actor);

  SELECT t.tarea
  INTO v_task_name
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF COALESCE(NEW.mime, '') LIKE 'audio/%' THEN
    v_type := 'voice_note_added';
    v_title := 'Nueva nota de voz';
  ELSE
    v_type := 'attachment_added';
    v_title := 'Nuevo archivo adjunto';
  END IF;

  PERFORM public.notify_task_audience(
    v_actor,
    NEW.task_id,
    v_type,
    v_title,
    v_actor_name || ' agregó "' || NEW.name || '" en "' || COALESCE(v_task_name, 'una tarea') || '".',
    jsonb_build_object(
      'attachment_id', NEW.id,
      'file_name', NEW.name,
      'mime', NEW.mime
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_attachment_insert ON public.task_attachments;
CREATE TRIGGER trg_notifications_attachment_insert
AFTER INSERT ON public.task_attachments
FOR EACH ROW
EXECUTE FUNCTION public.notifications_on_attachment_insert();

-- ------------------------------------------------------------
-- Collaborator checklist activity -> admins
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notifications_on_step_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_row public.task_steps%ROWTYPE;
  v_actor uuid;
  v_actor_name text;
  v_task_name text;
  v_type text;
  v_title text;
  v_message text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_actor := COALESCE(auth.uid(), v_row.owner_id);

  -- Admin checklist actions are not expected in the current UI and do not
  -- need to notify other admins.
  IF COALESCE(public.has_role(v_actor, 'admin'::public.app_role), false) THEN
    RETURN v_row;
  END IF;

  v_actor_name := public.notification_actor_name(v_actor);

  SELECT t.tarea
  INTO v_task_name
  FROM public.tasks t
  WHERE t.id = v_row.task_id;

  IF TG_OP = 'INSERT' THEN
    v_type := 'step_added';
    v_title := 'Nuevo paso de trabajo';
    v_message := v_actor_name || ' agregó el paso "' || v_row.title || '" en "' || COALESCE(v_task_name, 'una tarea') || '".';
  ELSIF TG_OP = 'DELETE' THEN
    v_type := 'step_deleted';
    v_title := 'Paso eliminado';
    v_message := v_actor_name || ' eliminó el paso "' || v_row.title || '" de "' || COALESCE(v_task_name, 'una tarea') || '".';
  ELSE
    IF NEW.done IS NOT DISTINCT FROM OLD.done
       AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
      RETURN NEW;
    END IF;

    IF NEW.done IS DISTINCT FROM OLD.done AND NEW.done = true THEN
      v_type := 'step_completed';
      v_title := 'Paso completado';
      v_message := v_actor_name || ' completó el paso "' || NEW.title || '" en "' || COALESCE(v_task_name, 'una tarea') || '".';
    ELSIF NEW.done IS DISTINCT FROM OLD.done AND NEW.done = false THEN
      v_type := 'step_reopened';
      v_title := 'Paso reabierto';
      v_message := v_actor_name || ' reabrió el paso "' || NEW.title || '" en "' || COALESCE(v_task_name, 'una tarea') || '".';
    ELSE
      v_type := 'step_updated';
      v_title := 'Paso actualizado';
      v_message := v_actor_name || ' actualizó un paso en "' || COALESCE(v_task_name, 'una tarea') || '".';
    END IF;
  END IF;

  PERFORM public.notify_task_admins(
    v_actor,
    v_row.task_id,
    v_type,
    v_title,
    v_message,
    jsonb_build_object('step_id', v_row.id)
  );

  RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_step_change ON public.task_steps;
CREATE TRIGGER trg_notifications_step_change
AFTER INSERT OR UPDATE OR DELETE ON public.task_steps
FOR EACH ROW
EXECUTE FUNCTION public.notifications_on_step_change();

-- Trigger functions must not be directly invokable by app users.
REVOKE ALL ON FUNCTION public.notifications_on_task_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifications_on_comment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifications_on_attachment_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifications_on_step_change() FROM PUBLIC, anon, authenticated;

-- Enable Postgres Changes for instant in-app notifications.
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$$;

COMMIT;
