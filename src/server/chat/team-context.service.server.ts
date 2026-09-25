import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TeamMemberContextSchema,
  MemberWorkloadSchema,
  type TeamMemberContext,
  type MemberWorkload,
} from "@/types/team-member-context";

export async function loadTeamMemberContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<TeamMemberContext | null> {
  console.log("[TeamContext] loading context for user:", userId);

  const { data, error } = await supabase
    .from("team_member_contexts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[TeamContext] error loading context:", {
      message: error.message,
    });
    return null;
  }

  if (!data) {
    console.log("[TeamContext] no context found for user");
    return null;
  }

  const parsed = TeamMemberContextSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[TeamContext] invalid context schema:", {
      errors: parsed.error.errors,
    });
    return null;
  }

  console.log("[TeamContext] context loaded successfully");
  return parsed.data;
}

export async function loadAllTeamContexts(
  supabase: SupabaseClient,
): Promise<TeamMemberContext[]> {
  console.log("[TeamContext] loading all contexts");

  const { data, error } = await supabase
    .from("team_member_contexts")
    .select("*");

  if (error) {
    console.error("[TeamContext] error loading all contexts:", {
      message: error.message,
    });
    return [];
  }

  if (!data) {
    return [];
  }

  const validated = (data as unknown[])
    .map((item) => TeamMemberContextSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data!);

  console.log(`[TeamContext] loaded ${validated.length} contexts`);
  return validated;
}

export async function loadMemberWorkload(
  supabase: SupabaseClient,
  userId: string,
): Promise<MemberWorkload | null> {
  console.log("[TeamContext] loading workload for user:", userId);

  // Load context to check if blocked
  const context = await loadTeamMemberContext(supabase, userId);

  // Load active tasks for this member
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, estado, fecha_limite")
    .eq("assigned_to", userId);

  if (tasksError) {
    console.error("[TeamContext] error loading tasks:", {
      message: tasksError.message,
    });
    return null;
  }

  const taskList = tasks || [];

  // Calculate task counts
  const pendingCount = taskList.filter(
    (t) => t.estado === "Pendiente",
  ).length;
  const inProgressCount = taskList.filter(
    (t) => t.estado === "En curso",
  ).length;
  const activeCount = pendingCount + inProgressCount;

  // Calculate overdue tasks (fecha_limite in the past)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueCount = taskList.filter((t) => {
    if (!t.fecha_limite) return false;
    const deadline = new Date(t.fecha_limite);
    deadline.setHours(0, 0, 0, 0);
    return deadline < today && t.estado !== "Completado";
  }).length;

  // Extract upcoming deadlines
  const deadlines = taskList
    .filter(
      (t) =>
        t.fecha_limite &&
        !["Completado", "Cancelado"].includes(t.estado),
    )
    .map((t) => t.fecha_limite as string)
    .sort()
    .slice(0, 5); // Next 5 deadlines

  const nearestDeadline = deadlines.length > 0 ? deadlines[0] : null;

  // Check if user is blocked
  const isBlocked = context ? isUserBlocked(context) : false;

  const workload: MemberWorkload = {
    member_id: userId,
    active_task_count: activeCount,
    pending_task_count: pendingCount,
    in_progress_task_count: inProgressCount,
    overdue_task_count: overdueCount,
    upcoming_deadlines: deadlines,
    nearest_deadline: nearestDeadline,
    is_blocked: isBlocked,
  };

  const parsed = MemberWorkloadSchema.safeParse(workload);
  if (!parsed.success) {
    console.error("[TeamContext] invalid workload schema:", {
      errors: parsed.error.errors,
    });
    return null;
  }

  console.log("[TeamContext] workload loaded:", {
    activeCount,
    overdueCount,
    nearestDeadline,
    isBlocked,
  });

  return parsed.data;
}

function isUserBlocked(context: TeamMemberContext): boolean {
  if (!context.blocked_dates || context.blocked_dates.length === 0) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return context.blocked_dates.some((range) => {
    const [start, end] = range.split("/");
    if (!start || !end) return false;

    const startDate = new Date(start);
    const endDate = new Date(end);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    return today >= startDate && today <= endDate;
  });
}
