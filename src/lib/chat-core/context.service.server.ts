import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadTeamMemberContext,
  loadMemberWorkload,
  loadAllTeamContexts,
} from "./team-context.service.server";
import type { TeamMemberContext, MemberWorkload } from "@/types/team-member-context";

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

export interface TeamMemberWithProfile {
  context: TeamMemberContext;
  fullName: string;
  email: string;
}

export interface UserContext {
  userId: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  tasks: TaskContext[];
  teamMemberContext: TeamMemberContext | null;
  memberWorkload: MemberWorkload | null;
  // Admin-only: Team context data with names
  teamMembers: TeamMemberWithProfile[];
  teamWorkloads: Map<string, MemberWorkload>; // keyed by user_id
}

export async function buildUserContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserContext> {
  console.log("[ChatContext] loading profile");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("[ChatContext] profile error:", {
      error: profileError?.message,
    });
    throw new Error("User profile not found");
  }

  console.log("[ChatContext] checking role");
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (roleError) {
    console.error("[ChatContext] role error:", {
      error: roleError.message,
    });
    throw new Error("Failed to check user role");
  }

  console.log("[ChatContext] loading tasks");
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(
      "id, tarea, cliente, area, estado, fecha_limite, fecha_entrega, assigned_to, observaciones",
    );

  if (tasksError) {
    console.error("[ChatContext] tasks error:", {
      error: tasksError.message,
    });
    throw new Error("Failed to fetch tasks");
  }

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

  console.log(`[ChatContext] tasks loaded: ${enrichedTasks.length}`);

  // Load team member context and workload
  console.log("[ChatContext] loading team member context");
  const teamMemberContext = await loadTeamMemberContext(supabase, userId);
  const memberWorkload = await loadMemberWorkload(supabase, userId);

  // Load team contexts for admin
  let teamMembers: TeamMemberWithProfile[] = [];
  const teamWorkloads = new Map<string, MemberWorkload>();

  if (isAdmin) {
    console.log("[ChatContext] loading all team contexts for admin");
    const teamContexts = await loadAllTeamContexts(supabase);

    // Load profiles for all team members
    if (teamContexts.length > 0) {
      const memberIds = teamContexts.map((c) => c.user_id);
      const { data: memberProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", memberIds);

      const profileMap = new Map(
        (memberProfiles || []).map((p) => [p.id, p]),
      );

      // Combine contexts with profiles
      for (const context of teamContexts) {
        const prof = profileMap.get(context.user_id);
        if (prof) {
          teamMembers.push({
            context,
            fullName: prof.full_name || prof.email,
            email: prof.email,
          });

          // Load workload for this team member
          const workload = await loadMemberWorkload(supabase, context.user_id);
          if (workload) {
            teamWorkloads.set(context.user_id, workload);
          }
        }
      }
    }

    console.log(`[ChatContext] loaded ${teamMembers.length} team members with profiles`);
  }

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name || profile.email,
    isAdmin: isAdmin || false,
    tasks: enrichedTasks,
    teamMemberContext,
    memberWorkload,
    teamMembers,
    teamWorkloads,
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

export function formatTeamMemberContextForAgent(
  context: TeamMemberContext | null,
): string {
  if (!context) {
    return "No hay contexto profesional disponible.";
  }

  const lines: string[] = [];

  if (context.role_title) {
    lines.push(`Rol: ${context.role_title}`);
  }

  if (context.role_summary) {
    lines.push(`Descripción: ${context.role_summary}`);
  }

  if (context.specialties && context.specialties.length > 0) {
    lines.push(`Especialidades: ${context.specialties.join(", ")}`);
  }

  if (context.responsibilities && context.responsibilities.length > 0) {
    lines.push(`Responsabilidades principales:\n  - ${context.responsibilities.join("\n  - ")}`);
  }

  if (context.strengths && context.strengths.length > 0) {
    lines.push(`Fortalezas: ${context.strengths.join(", ")}`);
  }

  if (context.typical_work && context.typical_work.length > 0) {
    lines.push(`Tipo de trabajo habitual:\n  - ${context.typical_work.join("\n  - ")}`);
  }

  if (context.capacity_hours_per_week) {
    lines.push(`Capacidad: ${context.capacity_hours_per_week} horas/semana`);
  }

  if (context.estimation_notes) {
    lines.push(`Notas para estimación: ${context.estimation_notes}`);
  }

  return lines.join("\n\n");
}

export function formatMemberWorkloadForAgent(workload: MemberWorkload | null): string {
  if (!workload) {
    return "No hay información de carga disponible.";
  }

  const lines: string[] = [
    `Tareas activas: ${workload.active_task_count}`,
    `  - Pendientes: ${workload.pending_task_count}`,
    `  - En curso: ${workload.in_progress_task_count}`,
    `  - Atrasadas: ${workload.overdue_task_count}`,
  ];

  if (workload.nearest_deadline) {
    lines.push(`Próximo vencimiento: ${workload.nearest_deadline}`);
  }

  if (workload.upcoming_deadlines && workload.upcoming_deadlines.length > 0) {
    lines.push(
      `Próximos vencimientos: ${workload.upcoming_deadlines.slice(0, 3).join(", ")}`,
    );
  }

  if (workload.is_blocked) {
    lines.push("⚠️ Usuario bloqueado/en período de bloqueo");
  }

  return lines.join("\n");
}

export function formatTeamContextForAgent(
  teamMembers: TeamMemberWithProfile[],
  teamWorkloads: Map<string, MemberWorkload>,
): string {
  if (teamMembers.length === 0) {
    return "No hay integrantes del equipo con contexto definido.";
  }

  const sections: string[] = [];

  for (const { context, fullName, email } of teamMembers) {
    const workload = teamWorkloads.get(context.user_id);
    const lines: string[] = [
      `INTEGRANTE: ${fullName}`,
      `  Email: ${email}`,
      `  ID: ${context.user_id}`,
    ];

    if (context.role_title) {
      lines.push(`  Rol: ${context.role_title}`);
    }

    if (context.specialties && context.specialties.length > 0) {
      lines.push(`  Especialidades: ${context.specialties.join(", ")}`);
    }

    if (context.responsibilities && context.responsibilities.length > 0) {
      lines.push(`  Responsabilidades:`);
      context.responsibilities.forEach((r) => {
        lines.push(`    - ${r}`);
      });
    }

    if (workload) {
      lines.push(`  Carga actual:`);
      lines.push(`    - Tareas activas: ${workload.active_task_count}`);
      lines.push(`    - Pendientes: ${workload.pending_task_count}`);
      lines.push(`    - En curso: ${workload.in_progress_task_count}`);
      lines.push(`    - Atrasadas: ${workload.overdue_task_count}`);
      if (workload.nearest_deadline) {
        lines.push(`    - Próximo vencimiento: ${workload.nearest_deadline}`);
      }
      if (workload.is_blocked) {
        lines.push(`    - ⚠️ Bloqueado/períodos de bloqueo`);
      }
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}
