import type { SupabaseClient } from "@supabase/supabase-js";

export interface TaskContext {
  id: string;
  tarea: string;
  cliente: string;
  area: string;
  estado: string;
  fecha_limite: string | null;
  fecha_entrega: string | null;
  assigned_to: string;
  observaciones: string | null;
  responsible_name?: string;
}

export interface UserContext {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  tasks: TaskContext[];
}

export async function buildUserContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserContext> {
  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    throw new Error("User profile not found");
  }

  // Check admin role
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (roleError) {
    throw new Error("Failed to check user role");
  }

  // Get tasks visible to user (RLS enforced by Supabase)
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, tarea, cliente, area, estado, fecha_limite, fecha_entrega, assigned_to, observaciones");

  if (tasksError) {
    throw new Error("Failed to fetch tasks");
  }

  // For admin users, enrich with assigned person names
  let enrichedTasks = tasks || [];
  if (isAdmin && enrichedTasks.length > 0) {
    const assignedIds = [...new Set(enrichedTasks.map((t) => t.assigned_to))];
    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedIds);

    const nameMap = new Map((people || []).map((p) => [p.id, p.full_name]));
    enrichedTasks = enrichedTasks.map((t) => ({
      ...t,
      responsible_name: nameMap.get(t.assigned_to),
    }));
  }

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name || profile.email,
    isAdmin: isAdmin || false,
    tasks: enrichedTasks,
  };
}

export function formatTasksForContext(tasks: TaskContext[], isAdmin: boolean): string {
  if (tasks.length === 0) {
    return "No hay tareas disponibles.";
  }

  const taskLines = tasks.map((t) => {
    const responsible = isAdmin && t.responsible_name ? ` (${t.responsible_name})` : "";
    const dueDate = t.fecha_limite ? ` | Vence: ${t.fecha_limite}` : "";
    return `- [${t.estado}] ${t.tarea} (${t.cliente}/${t.area})${responsible}${dueDate}`;
  });

  return taskLines.join("\n");
}
