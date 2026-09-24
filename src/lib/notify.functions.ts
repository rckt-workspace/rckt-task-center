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

/**
 * Notifies via email when a task is reassigned.
 * Called when assigned_to changes. Does not block if email fails.
 * Validates that reassignment actually occurred server-side.
 */
export const notifyTaskReassigned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        newAssignedId: z.string().uuid(),
        previousAssignedId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { taskId, newAssignedId, previousAssignedId } = data;

    try {
      // Verify user is admin (only admins can reassign)
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (!isAdmin) {
        return { sent: false, reason: "forbidden" as const };
      }

      // Read current task state from server
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("tarea, cliente, area, estado, fecha_limite, observaciones, assigned_to")
        .eq("id", taskId)
        .maybeSingle();

      if (taskError || !task) {
        return { sent: false, reason: "task_not_found" as const };
      }

      // Verify reassignment actually occurred (avoid sending email if data mismatch)
      if (task.assigned_to !== newAssignedId) {
        console.warn(
          `Task reassignment mismatch for ${taskId}: server has ${task.assigned_to}, client sent ${newAssignedId}`,
        );
        return { sent: false, reason: "reassignment_mismatch" as const };
      }

      const { data: newAssignee } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", newAssignedId)
        .maybeSingle();

      const { data: oldAssignee } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", previousAssignedId)
        .maybeSingle();

      if (!newAssignee?.email) {
        return { sent: false, reason: "no_email" as const };
      }

      try {
        const { sendTaskReassignedEmail } = await import("@/integrations/email/service");
        const result = await sendTaskReassignedEmail({
          to: newAssignee.email,
          name: newAssignee.full_name || newAssignee.email,
          taskName: task.tarea,
          client: task.cliente,
          area: task.area,
          status: task.estado,
          dueDate: task.fecha_limite,
          ...(oldAssignee?.full_name ? { previousAssignee: oldAssignee.full_name } : {}),
          details: task.observaciones,
        });

        if (!result.sent) {
          console.warn(`Task reassignment email not sent for task ${taskId}: ${result.error}`);
          return {
            sent: false,
            reason: "provider_error" as const,
            error: result.error,
          };
        }

        return { sent: true, id: result.messageId ?? null, to: newAssignee.email };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.warn(`Error sending reassignment email for task ${taskId}: ${errorMsg}`);
        return { sent: false, reason: "provider_error" as const, error: errorMsg };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`notifyTaskReassigned error: ${errorMsg}`);
      return { sent: false, reason: "provider_error" as const, error: errorMsg };
    }
  });
