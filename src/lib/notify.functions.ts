import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTaskAssignedEmail } from "@/integrations/email/service";

const schema = z.object({ taskId: z.string().uuid() });

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

    // Notas de voz adjuntas: enlace firmado (7 días) para escuchar/descargar
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

    try {
      const result = await sendTaskAssignedEmail({
        to: assignee.email,
        name: assignee.full_name || assignee.email,
        taskName: task.tarea,
        client: task.cliente,
        area: task.area,
        status: task.estado,
        dueDate: task.fecha_limite,
        authorName: author?.full_name || author?.email || "Coordinación",
        details: task.observaciones,
        audioLinks,
      });

      if (!result.sent) {
        console.error(`Email send failed: ${result.error}`);
        return { sent: false, reason: "provider_error" as const, error: result.error };
      }

      return { sent: true, id: result.messageId ?? null, to: assignee.email };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`Email send failed: ${errorMsg}`);
      return { sent: false, reason: "provider_error" as const, error: errorMsg };
    }
  });
