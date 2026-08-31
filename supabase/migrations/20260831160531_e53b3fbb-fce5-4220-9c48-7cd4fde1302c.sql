-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'colaborador');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Tareas
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana DATE NOT NULL,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  cliente TEXT NOT NULL,
  tarea TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  fecha_limite DATE NOT NULL,
  fecha_entrega DATE,
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attention_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semana DATE NOT NULL,
  cliente TEXT NOT NULL,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attention_points TO authenticated;
GRANT ALL ON public.attention_points TO service_role;
ALTER TABLE public.attention_points ENABLE ROW LEVEL SECURITY;

-- Politicas
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles_update_own_or_admin" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles_admin_insert" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles_admin_delete" ON public.profiles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tasks_insert_admin" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tasks_delete_admin" ON public.tasks
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "points_select" ON public.attention_points
FOR SELECT TO authenticated
USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "points_admin_all" ON public.attention_points
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_points_updated BEFORE UPDATE ON public.attention_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Perfil automatico al crear usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'admin' THEN 'admin'::public.app_role
         ELSE 'colaborador'::public.app_role END
  )
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();