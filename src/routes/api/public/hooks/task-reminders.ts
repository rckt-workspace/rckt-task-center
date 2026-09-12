import { createFileRoute } from "@tanstack/react-router";
import { sendTaskDueTodayEmail } from "@/integrations/email/service";

/** Valida el token privado del cron (Authorization: Bearer <TASK_REMINDER_CRON_SECRET>). */
async function authenticateCronRequest(request: Request): Promise<Response | null> {
  const secret = process.env["TASK_REMINDER_CRON_SECRET"];
  if (!secret) return new Response("Server configuration error", { status: 500 });
  const match = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  if (!timingSafeEqual(digest(token), digest(secret)))
    return new Response("Unauthorized", { status: 401 });
  return null;
}

/** Fecha de hoy (yyyy-MM-dd) en zona America/Bogota */
function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Recordatorio diario (8:00 America/Bogota vía pg_cron):
 * envía correo a cada colaborador con tareas que vencen hoy y no están completadas.
 */
export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = todayBogota();

        // Solo tareas que vencen hoy y NO están completadas (se evalúa en el momento del envío)
        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id, tarea, cliente, area, estado, fecha_limite, observaciones, assigned_to")
          .eq("fecha_limite", today)
          .neq("estado", "Completada");
        if (error) {
          console.error("task-reminders: error leyendo tareas", error);
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        if (!tasks || tasks.length === 0) {
          return Response.json({ ok: true, date: today, sent: 0, results: [] });
        }

        const ids = [...new Set(tasks.map((t) => t.assigned_to))];
        const { data: people } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        const byId = new Map((people ?? []).map((p) => [p.id, p]));

        const results: Array<{
          taskId: string;
          to: string | null;
          sent: boolean;
          reason?: string;
        }> = [];
        for (const task of tasks) {
          const person = byId.get(task.assigned_to);
          if (!person?.email) {
            results.push({ taskId: task.id, to: null, sent: false, reason: "no_email" });
            continue;
          }
          try {
            const res = await sendTaskDueTodayEmail({
              to: person.email,
              name: person.full_name || person.email,
              taskName: task.tarea,
              client: task.cliente,
              area: task.area,
              status: task.estado,
              dueDate: task.fecha_limite,
              details: task.observaciones,
            });
            if (!res.sent) {
              console.error(`task-reminders: email send failed for task ${task.id}: ${res.error}`);
              results.push({
                taskId: task.id,
                to: person.email,
                sent: false,
                reason: `provider_error: ${res.error}`,
              });
            } else {
              results.push({ taskId: task.id, to: person.email, sent: true });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            console.error(`task-reminders: error sending email for task ${task.id}: ${errMsg}`);
            results.push({
              taskId: task.id,
              to: person.email,
              sent: false,
              reason: `error: ${errMsg}`,
            });
          }
        }

        const sent = results.filter((r) => r.sent).length;
        console.log(`task-reminders ${today}: ${sent}/${tasks.length} enviados`);
        return Response.json({ ok: true, date: today, sent, total: tasks.length, results });
      },
    },
  },
});
