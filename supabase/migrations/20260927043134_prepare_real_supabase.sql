-- ============================================================
-- RCKT Task Center - Production Supabase preparation
-- ============================================================

-- ------------------------------------------------------------
-- Storage bucket para adjuntos de tareas
-- ------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public
)
VALUES (
  'task-attachments',
  'task-attachments',
  false
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false;


-- ------------------------------------------------------------
-- Campos administrativos adicionales para perfiles
-- ------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;