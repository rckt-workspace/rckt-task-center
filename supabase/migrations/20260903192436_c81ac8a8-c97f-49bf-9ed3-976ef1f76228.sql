ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tasks_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS comments_seen_at timestamptz;