import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Area, Cliente } from "./types";

export interface TaskTemplate {
  id: string;
  nombre: string;
  cliente: Cliente;
  area: Area;
  tarea: string;
  observaciones: string;
  enlaces: string[];
  createdAt: string;
}

export interface TaskTemplateInput {
  nombre: string;
  cliente: Cliente;
  area: Area;
  tarea: string;
  observaciones: string;
  enlaces: string[];
}

/** Plantillas de tareas reutilizables (solo administradora; RLS lo garantiza). */
export function useTaskTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("task_templates")
      .select("*")
      .order("nombre", { ascending: true });
    setLoading(false);
    if (error) throw new Error(error.message);
    setTemplates(
      (data ?? []).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        cliente: r.cliente as Cliente,
        area: r.area as Area,
        tarea: r.tarea,
        observaciones: r.observaciones,
        enlaces: r.enlaces ?? [],
        createdAt: r.created_at,
      })),
    );
  }, [enabled]);

  useEffect(() => {
    refresh().catch(() => setTemplates([]));
  }, [refresh]);

  const save = useCallback(
    async (input: TaskTemplateInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("task_templates").insert({
        nombre: input.nombre.trim(),
        cliente: input.cliente,
        area: input.area,
        tarea: input.tarea.trim(),
        observaciones: input.observaciones,
        enlaces: input.enlaces,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("task_templates").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    },
    [],
  );

  return { templates, loading, refresh, save, remove };
}
