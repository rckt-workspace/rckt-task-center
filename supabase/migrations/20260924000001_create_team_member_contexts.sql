-- Create team_member_contexts table for flexible team member profiling
-- Supports technical and non-technical roles
-- Portable schema for future migration to RCKT's own Supabase

CREATE TABLE IF NOT EXISTS team_member_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role and professional context
  role_title TEXT,
  role_summary TEXT,
  specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  responsibilities TEXT[] DEFAULT ARRAY[]::TEXT[],
  strengths TEXT[] DEFAULT ARRAY[]::TEXT[],
  typical_work TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Capacity and constraints
  capacity_hours_per_week NUMERIC,
  blocked_dates TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Context for future estimation
  estimation_notes TEXT,
  collaboration_notes TEXT,
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_team_member_contexts_user_id ON team_member_contexts(user_id);

-- Enable Row Level Security
ALTER TABLE team_member_contexts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can SELECT all contexts
CREATE POLICY "Admins select all team_member_contexts"
  ON team_member_contexts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policy: Users can SELECT their own context
CREATE POLICY "Users select own team_member_context"
  ON team_member_contexts
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Only admins can INSERT
CREATE POLICY "Admins insert team_member_contexts"
  ON team_member_contexts
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policy: Only admins can UPDATE
CREATE POLICY "Admins update team_member_contexts"
  ON team_member_contexts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policy: Only admins can DELETE
CREATE POLICY "Admins delete team_member_contexts"
  ON team_member_contexts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Grant permissions to authenticated users
GRANT SELECT ON team_member_contexts TO authenticated;
GRANT INSERT ON team_member_contexts TO authenticated;
GRANT UPDATE ON team_member_contexts TO authenticated;
GRANT DELETE ON team_member_contexts TO authenticated;
