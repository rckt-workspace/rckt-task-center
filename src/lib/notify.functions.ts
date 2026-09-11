import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendEmail } from "@/integrations/email/email.service";

const schema = z.object({ taskId: z.string().uuid() });

const NAVY = "#1B2A4A";
const IVORY = "#FAF7F0";
const BORDER = "#E5E1D8";
const TEXT = "#3A3D44";

function esc(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function fmt(d: string | null) {
  if (!d) return "Sin definir";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;color:${TEXT};font-size:13px;width:150px;">${esc(label)}</td>
    <td style="padding:8px 0;color:#111214;font-size:14px;font-weight:600;">${esc(value)}</td>
  </tr>`;
}

/** Envía por correo el detalle de una tarea recién asignada. Solo administradoras. */
export const notifyTaskAssigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return { sent: false, reason: "forbidden" as const };

    const { data: task, error } = await supabase
      .from("tasks")
      .select("tarea, area, cliente, estado, fecha_limite, observaciones, assigned_to")
      .eq("id", data.taskId)
      .maybeSingle();
    if (error || !task) return { sent: false, reason: "task_not_found" as const };

    const { data: people } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", [task.assigned_to, userId]);

    const assignee = (people ?? []).find((p) => p.id === task.assigned_to);
    const author = (people ?? []).find((p) => p.id === userId);
    if (!assignee?.email) return { sent: false, reason: "no_email" as const };

    const { data: attachments } = await supabase
      .from("task_attachments")
      .select("name, path, mime")
      .eq("task_id", data.taskId)
      .order("created_at");
    const audioRows = (attachments ?? []).filter(
      (a) => a.mime.startsWith("audio/") || /\.(webm|m4a|mp3|ogg|wav|aac)$/i.test(a.name),
    );
    const audioLinks: { name: string; url: string }[] = [];
    for (const a of audioRows) {
      const { data: signed } = await supabase.storage
        .from("task-attachments")
        .createSignedUrl(a.path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) audioLinks.push({ name: a.name, url: signed.signedUrl });
    }
    const audioBlock =
      audioLinks.length > 0
        ? `<div style="margin-top:16px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:10px;padding:14px 16px;">
        <div style="color:#111214;font-size:13px;font-weight:700;margin-bottom:8px;">🎙 Nota de voz de la coordinadora</div>
        ${audioLinks
          .map(
            (l) => `<a href="${esc(l.url)}" style="display:inline-block;margin:4px 8px 4px 0;background:${NAVY};color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:600;padding:9px 14px;border-radius:8px;">Escuchar audio</a>`,
          )
          .join("")}
        <div style="color:${TEXT};font-size:11px;margin-top:8px;">El enlace abre o descarga el audio y es válido por 7 días. También puedes escucharlo en el detalle de la tarea.</div>
      </div>`
        : "";

    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:${IVORY};font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#FFFDF8;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
    <tr><td style="background:${NAVY};padding:20px 24px;">
      <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:2px;">RCKT</div>
      <div style="color:#C9D2E4;font-size:12px;margin-top:4px;">Centro de Control Semanal</div>
    </td></tr>
    <tr><td style="padding:24px;">
      <p style="margin:0 0 4px;color:${TEXT};font-size:13px;">Hola ${esc(assignee.full_name || assignee.email)},</p>
      <h1 style="margin:0 0 16px;color:#111214;font-size:18px;">Tienes una nueva tarea asignada</h1>
      <div style="background:${IVORY};border:1px solid ${BORDER};border-radius:10px;padding:16px;">
        <div style="color:#111214;font-size:16px;font-weight:700;margin-bottom:8px;">${esc(task.tarea)}</div>
        <table role="presentation" width="100%">
          ${row("Cliente", task.cliente)}
          ${row("Área", task.area)}
          ${row("Estado", task.estado)}
          ${row("Fecha límite", fmt(task.fecha_limite))}
          ${row("Asignada por", author?.full_name || author?.email || "Coordinación")}
          ${task.observaciones ? row("Detalle", task.observaciones) : ""}
        </table>
      </div>
      ${audioBlock}
      <p style="margin:20px 0 0;color:${TEXT};font-size:12px;">Ingresa al Centro de Control Semanal para actualizar el estado de tu tarea.</p>
    </td></tr>
  </table>
</body></html>`;

    const result = await sendEmail({
      to: assignee.email,
      subject: `Nueva tarea asignada: ${task.tarea}`,
      html,
    });

    if (!result.sent) {
      console.error(`Task assignment email failed via ${result.provider}: ${result.error ?? "unknown error"}`);
      return { sent: false, reason: "provider_error" as const, provider: result.provider, error: result.error ?? null };
    }

    return {
      sent: true,
      id: result.messageId ?? null,
      provider: result.provider,
      to: assignee.email,
    };
  });
