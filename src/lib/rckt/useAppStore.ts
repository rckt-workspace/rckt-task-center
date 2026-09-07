import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mondayOf, fromISO, toISO, todayISO } from "./dates";
import type { AppData, AttentionPoint, Perfil, Rol, Task } from "./types";
import type { Database } from "@/integrations/supabase/types";
import { notifyTaskAssigned } from "@/lib/notify.functions";


type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];
type PointUpdate = Database["public"]["Tables"]["attention_points"]["Update"];

const SEMANAS_KEY = "rckt.semanas.v1";

/** Semana (lunes ISO) correspondiente a una fecha límite. */
export function semanaDeFechaLimite(fechaLimite: string): string {
  return toISO(mondayOf(fromISO(fechaLimite)));
}

export interface TaskInput {
  colaborador: string;
  area: Task["area"];
  cliente: Task["cliente"];
  tarea: string;
  estado: Task["estado"];
  fechaLimite: string;
  horaLimite: string | null;
  fechaEntrega: string | null;
  observaciones: string;
  enlaces: string[];
  /** Archivos nuevos a subir al guardar */
  nuevosArchivos: File[];
  /** IDs de adjuntos existentes a eliminar al guardar */
  eliminarAdjuntos: string[];
}

/** Normaliza la fecha de entrega según las reglas de estado. */
export function applyEstadoRules(
  prevEstado: Task["estado"] | null,
  nextEstado: Task["estado"],
  fechaEntrega: string | null,
): string | null {
  if (nextEstado === "Completada") return fechaEntrega ?? todayISO();
  return null;
}

interface TaskRow {
  id: string;
  semana: string;
  assigned_to: string;
  area: string;
  cliente: string;
  tarea: string;
  estado: string;
  fecha_limite: string;
  hora_limite: string | null;
  fecha_entrega: string | null;
  observaciones: string;
  enlaces: string[];
  created_at: string;
  updated_at: string;
}

interface AttachmentRow {
  id: string;
  task_id: string;
  name: string;
  path: string;
  mime: string;
  size: number;
  created_at: string;
}

interface PointRow {
  id: string;
  semana: string;
  cliente: string;
  assigned_to: string;
  task_id: string | null;
  tipo: string;
  motivo: string;
  created_at: string;
  updated_at: string;
}

export const ATTACHMENTS_BUCKET = "task-attachments";

function safeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-120);
}

/** Sube archivos al storage y registra los adjuntos de una tarea. */
async function uploadAttachments(taskId: string, files: File[], userId: string | null) {
  for (const file of files) {
    const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) throw new Error(`No se pudo subir "${file.name}": ${upErr.message}`);
    const { error: rowErr } = await supabase.from("task_attachments").insert({
      task_id: taskId,
      name: file.name,
      path,
      mime: file.type,
      size: file.size,
      uploaded_by: userId,
    });
    if (rowErr) throw rowErr;
  }
}

async function removeAttachments(rows: AttachmentRow[], ids: string[]) {
  const targets = rows.filter((r) => ids.includes(r.id));
  if (targets.length === 0) return;
  await supabase.storage.from(ATTACHMENTS_BUCKET).remove(targets.map((t) => t.path));
  const { error } = await supabase.from("task_attachments").delete().in("id", ids);
  if (error) throw error;
}

/** URL firmada temporal para abrir/descargar un adjunto. */
export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error || !data) throw error ?? new Error("No se pudo generar el enlace");
  return data.signedUrl;
}

/** URL firmada que fuerza la descarga del archivo con su nombre original. */
export async function getAttachmentDownloadUrl(path: string, fileName: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 60, { download: fileName });
  if (error || !data) throw error ?? new Error("No se pudo generar el enlace de descarga");
  return data.signedUrl;
}

function loadSemanas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEMANAS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useAppStore() {
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<Perfil[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [pointRows, setPointRows] = useState<PointRow[]>([]);
  const [attachmentRows, setAttachmentRows] = useState<AttachmentRow[]>([]);
  const [semanas, setSemanas] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  /** ID del usuario para el que se completó la última carga de datos (null = sin sesión). */
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setSemanas(loadSemanas());
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setTaskRows([]);
      setPointRows([]);
      setProfiles([]);
      setIsAdmin(false);
      setHydrated(true);
      setLoadedFor(null);
      return;
    }
    const [myRolesRes, allRolesRes, profilesRes, tasksRes, pointsRes, attachRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profiles").select("id, full_name, email, cargo").order("full_name"),
      supabase.from("tasks").select("*").order("fecha_limite"),
      supabase.from("attention_points").select("*").order("created_at"),
      supabase.from("task_attachments").select("*").order("created_at"),
    ]);
    setIsAdmin((myRolesRes.data ?? []).some((r) => r.role === "admin"));
    const roleMap = new Map((allRolesRes.data ?? []).map((r) => [r.user_id, r.role as import("./types").Rol]));
    setProfiles(
      (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        nombre: p.full_name || p.email,
        email: p.email,
        cargo: p.cargo,
        role: roleMap.get(p.id),
      })),
    );
    setTaskRows((tasksRes.data ?? []) as TaskRow[]);
    setPointRows((pointsRes.data ?? []) as PointRow[]);
    setAttachmentRows((attachRes.data ?? []) as AttachmentRow[]);
    setHydrated(true);
    setLoadedFor(userId);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const nameOf = useCallback(
    (id: string) => profiles.find((p) => p.id === id)?.nombre ?? "—",
    [profiles],
  );

  const idOf = useCallback(
    (nombre: string) => profiles.find((p) => p.nombre === nombre)?.id ?? null,
    [profiles],
  );

  const data: AppData = useMemo(
    () => ({
      tasks: taskRows.map<Task>((r) => ({
        id: r.id,
        semana: r.semana,
        assignedTo: r.assigned_to,
        colaborador: nameOf(r.assigned_to),
        area: r.area,
        cliente: r.cliente,
        tarea: r.tarea,
        estado: r.estado as Task["estado"],
        fechaLimite: r.fecha_limite,
        horaLimite: r.hora_limite,
        fechaEntrega: r.fecha_entrega,
        observaciones: r.observaciones,
        enlaces: r.enlaces ?? [],
        adjuntos: attachmentRows
          .filter((a) => a.task_id === r.id)
          .map((a) => ({
            id: a.id,
            taskId: a.task_id,
            name: a.name,
            path: a.path,
            mime: a.mime,
            size: a.size,
            createdAt: a.created_at,
          })),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      puntos: pointRows.map<AttentionPoint>((r) => ({
        id: r.id,
        semana: r.semana,
        cliente: r.cliente,
        assignedTo: r.assigned_to,
        colaborador: nameOf(r.assigned_to),
        taskId: r.task_id ?? "",
        tipo: r.tipo as AttentionPoint["tipo"],
        motivo: r.motivo,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      semanas,
    }),
    [taskRows, attachmentRows, pointRows, semanas, nameOf],
  );

  const perfil = useMemo(
    () => profiles.find((p) => p.id === userId) ?? null,
    [profiles, userId],
  );

  const createTask = useCallback(
    async (semana: string, input: TaskInput) => {
      const assigned = idOf(input.colaborador);
      if (!assigned) throw new Error("Colaborador no encontrado");
      const { data: inserted, error } = await supabase
        .from("tasks")
        .insert({
          semana: input.fechaLimite ? semanaDeFechaLimite(input.fechaLimite) : semana,
          assigned_to: assigned,
          area: input.area,
          cliente: input.cliente,
          tarea: input.tarea,
          estado: input.estado,
          fecha_limite: input.fechaLimite,
          hora_limite: input.horaLimite || null,
          fecha_entrega: applyEstadoRules(null, input.estado, input.fechaEntrega),
          observaciones: input.observaciones,
          enlaces: input.enlaces,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) {
        let uploadError: unknown = null;
        if (input.nuevosArchivos.length > 0) {
          try {
            await uploadAttachments(inserted.id, input.nuevosArchivos, userId);
          } catch (e) {
            uploadError = e;
          }
        }
        try {
          const res = await notifyTaskAssigned({ data: { taskId: inserted.id } });
          if (!res.sent) console.warn("Correo de asignación no enviado:", res.reason);
        } catch (e) {
          console.warn("Correo de asignación no enviado:", e);
        }
        if (uploadError) {
          await refresh();
          throw uploadError instanceof Error
            ? new Error(`Tarea creada, pero ${uploadError.message}`)
            : new Error("Tarea creada, pero falló la subida de adjuntos");
        }
      }
      await refresh();
    },
    [idOf, refresh, userId],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task> & Partial<TaskInput>) => {
      const current = taskRows.find((t) => t.id === id);
      if (!current) return;
      const update: TaskUpdate = {};
      if (patch.colaborador !== undefined) {
        const assigned = idOf(patch.colaborador);
        if (assigned) update["assigned_to"] = assigned;
      }
      if (patch.area !== undefined) update["area"] = patch.area;
      if (patch.cliente !== undefined) update["cliente"] = patch.cliente;
      if (patch.tarea !== undefined) update["tarea"] = patch.tarea;
      if (patch.observaciones !== undefined) update["observaciones"] = patch.observaciones;
      if (patch.fechaLimite !== undefined && patch.fechaLimite) {
        update["fecha_limite"] = patch.fechaLimite;
        update["semana"] = semanaDeFechaLimite(patch.fechaLimite);
      }
      if (patch.horaLimite !== undefined) update["hora_limite"] = patch.horaLimite || null;
      if (patch.estado !== undefined) {
        update["estado"] = patch.estado;
        update["fecha_entrega"] =
          patch.estado === "Completada"
            ? (patch.fechaEntrega ?? current.fecha_entrega ?? todayISO())
            : null;
      } else if (patch.fechaEntrega !== undefined) {
        update["fecha_entrega"] = patch.fechaEntrega;
      }
      if (patch.enlaces !== undefined) update["enlaces"] = patch.enlaces;
      const { error } = await supabase.from("tasks").update(update).eq("id", id);
      if (error) throw error;
      if (patch.eliminarAdjuntos?.length) {
        await removeAttachments(attachmentRows, patch.eliminarAdjuntos);
      }
      if (patch.nuevosArchivos?.length) {
        await uploadAttachments(id, patch.nuevosArchivos, userId);
      }
      await refresh();
    },
    [taskRows, attachmentRows, idOf, refresh, userId],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const paths = attachmentRows.filter((a) => a.task_id === id).map((a) => a.path);
      if (paths.length > 0) {
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
      }
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [attachmentRows, refresh],
  );

  const addSemana = useCallback((mondayIso: string) => {
    setSemanas((prev) => {
      if (prev.includes(mondayIso)) return prev;
      const next = [...prev, mondayIso];
      try {
        window.localStorage.setItem(SEMANAS_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  const createPunto = useCallback(
    async (
      semana: string,
      input: { taskId: string; tipo: string; motivo: string; cliente: string; colaborador: string },
    ) => {
      const assigned = idOf(input.colaborador);
      if (!assigned) throw new Error("Colaborador no encontrado");
      const { error } = await supabase.from("attention_points").insert({
        semana,
        cliente: input.cliente,
        assigned_to: assigned,
        task_id: input.taskId,
        tipo: input.tipo,
        motivo: input.motivo,
      });
      if (error) throw error;
      await refresh();
    },
    [idOf, refresh],
  );

  const updatePunto = useCallback(
    async (
      id: string,
      patch: { taskId?: string; tipo?: string; motivo?: string; cliente?: string; colaborador?: string },
    ) => {
      const update: PointUpdate = {};
      if (patch.taskId !== undefined) update["task_id"] = patch.taskId;
      if (patch.tipo !== undefined) update["tipo"] = patch.tipo;
      if (patch.motivo !== undefined) update["motivo"] = patch.motivo;
      if (patch.cliente !== undefined) update["cliente"] = patch.cliente;
      if (patch.colaborador !== undefined) {
        const assigned = idOf(patch.colaborador);
        if (assigned) update["assigned_to"] = assigned;
      }
      const { error } = await supabase.from("attention_points").update(update).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [idOf, refresh],
  );

  const deletePunto = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("attention_points").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
  );

  return {
    data,
    profiles,
    perfil,
    isAdmin,
    session,
    hydrated,
    loadedFor,
    refresh,
    createTask,
    updateTask,
    deleteTask,
    addSemana,
    createPunto,
    updatePunto,
    deletePunto,
  };
}
