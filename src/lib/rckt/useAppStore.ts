import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mondayOf, fromISO, toISO, todayISO } from "./dates";
import type { AppData, AttentionPoint, Perfil, Task } from "./types";
import type { Database } from "@/integrations/supabase/types";

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
  fechaEntrega: string | null;
  observaciones: string;
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
  fecha_entrega: string | null;
  observaciones: string;
  created_at: string;
  updated_at: string;
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
  const [semanas, setSemanas] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

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
      return;
    }
    const [rolesRes, profilesRes, tasksRes, pointsRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("tasks").select("*").order("fecha_limite"),
      supabase.from("attention_points").select("*").order("created_at"),
    ]);
    setIsAdmin((rolesRes.data ?? []).some((r) => r.role === "admin"));
    setProfiles(
      (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        nombre: p.full_name || p.email,
        email: p.email,
      })),
    );
    setTaskRows((tasksRes.data ?? []) as TaskRow[]);
    setPointRows((pointsRes.data ?? []) as PointRow[]);
    setHydrated(true);
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
        fechaEntrega: r.fecha_entrega,
        observaciones: r.observaciones,
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
    [taskRows, pointRows, semanas, nameOf],
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
          fecha_entrega: applyEstadoRules(null, input.estado, input.fechaEntrega),
          observaciones: input.observaciones,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (inserted?.id) {
        try {
          const res = await notifyTaskAssigned({ data: { taskId: inserted.id } });
          if (!res.sent) console.warn("Correo de asignación no enviado:", res.reason);
        } catch (e) {
          console.warn("Correo de asignación no enviado:", e);
        }
      }
      await refresh();
    },

    [idOf, refresh],
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
      if (patch.estado !== undefined) {
        update["estado"] = patch.estado;
        update["fecha_entrega"] =
          patch.estado === "Completada"
            ? (patch.fechaEntrega ?? current.fecha_entrega ?? todayISO())
            : null;
      } else if (patch.fechaEntrega !== undefined) {
        update["fecha_entrega"] = patch.fechaEntrega;
      }
      const { error } = await supabase.from("tasks").update(update).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [taskRows, idOf, refresh],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh],
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
