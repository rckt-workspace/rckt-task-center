import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const NAVY = "#1B2A4A";
const IVORY = "#FAF7F0";
const BORDER = "#E5E1D8";
const TEXT = "#3A3D44";
const ALERT = "#B42318";

function esc(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function fmt(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
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

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:${TEXT};font-size:13px;width:150px;">${esc(label)}</td>
    <td style="padding:8px 0;color:#111214;font-size:14px;font-weight:600;">${esc(value)}</td>
  </tr>`;
}

function buildHtml(name: string, task: { tarea: string; cliente: string; area: string; estado: string; fecha_limite: string; observaciones: string }) {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:${IVORY};font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
    <tr><td style="background:${NAVY};padding:20px 24px;">
      <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:2px;">RCKT</div>
      <div style="color:#C9D2E4;font-size:12px;margin-top:4px;">Centro de Control Semanal</div>
    </td></tr>
    <tr><td style="padding:24px;">
      <p style="margin:0 0 4px;color:${TEXT};font-size:13px;">Hola ${esc(name)},</p>
      <h1 style="margin:0 0 12px;color:#111214;font-size:18px;">Recordatorio: tu tarea vence hoy</h1>
      <div style="display:inline-block;background:#FDECEA;color:${ALERT};border:1px solid #F5C2BD;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;margin-bottom:16px;">VENCE HOY · ${esc(fmt(task.fecha_limite))}</div>
      <div style="background:${IVORY};border:1px solid ${BORDER};border-radius:10px;padding:16px;">
        <div style="color:#111214;font-size:16px;font-weight:700;margin-bottom:8px;">${esc(task.tarea)}</div>
        <table role="presentation" width="100%">
          ${row("Cliente", task.cliente)}
          ${row("Área", task.area)}
          ${row("Estado actual", task.estado)}
          ${row("Fecha límite", fmt(task.fecha_limite))}
          ${task.observaciones ? row("Detalle", task.observaciones) : ""}
        </table>
      </div>
      <p style="margin:20px 0 0;color:${TEXT};font-size:12px;">Si ya la terminaste, márcala como <strong>Completada</strong> en el Centro de Control Semanal.</p>
    </td></tr>
  </table>
</body></html>`;
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

        const apiKey = process.env["RESEND_API_KEY"];
        if (!apiKey) {
          return Response.json({ ok: false, error: "RESEND_API_KEY no configurada" }, { status: 500 });
        }

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
        const { data: people } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids);
        const byId = new Map((people ?? []).map((p) => [p.id, p]));

        const results: Array<{ taskId: string; to: string | null; sent: boolean; reason?: string }> = [];
        for (const task of tasks) {
          const person = byId.get(task.assigned_to);
          if (!person?.email) {
            results.push({ taskId: task.id, to: null, sent: false, reason: "no_email" });
            continue;
          }
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              from: "RCKT <onboarding@resend.dev>",
              to: [person.email],
              subject: `Recordatorio: la tarea ${task.tarea} vence hoy`,
              html: buildHtml(person.full_name || person.email, task),
            }),
          });
          if (!res.ok) {
            const body = await res.text();
            console.error(`task-reminders: Resend falló [${res.status}] ${body}`);
            results.push({ taskId: task.id, to: person.email, sent: false, reason: `provider_error ${res.status}: ${body}` });
          } else {
            results.push({ taskId: task.id, to: person.email, sent: true });
          }
        }

        const sent = results.filter((r) => r.sent).length;
        console.log(`task-reminders ${today}: ${sent}/${tasks.length} enviados`);
        return Response.json({ ok: true, date: today, sent, total: tasks.length, results });
      },
    },
  },
});
