import { useCallback, useEffect, useState } from "react";
import { loadData, loadUser, newId, saveData, saveUser } from "./storage";
import { todayISO } from "./dates";
import type { AppData, AttentionPoint, Identidad, Task } from "./types";

export interface TaskInput {
  colaborador: Task["colaborador"];
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
  if (nextEstado === "Completada") {
    return fechaEntrega ?? todayISO();
  }
  if (prevEstado === "Completada" || fechaEntrega) return null;
  return null;
}

export function useAppStore() {
  const [data, setData] = useState<AppData>({ tasks: [], semanas: [], puntos: [] });
  const [user, setUserState] = useState<Identidad | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(loadData());
    setUserState(loadUser());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveData(data);
  }, [data, hydrated]);

  const setUser = useCallback((next: Identidad | null) => {
    setUserState(next);
    saveUser(next);
  }, []);

  const createTask = useCallback((semana: string, input: TaskInput) => {
    const now = new Date().toISOString();
    const fechaEntrega = applyEstadoRules(null, input.estado, input.fechaEntrega);
    const task: Task = {
      id: newId(),
      semana,
      ...input,
      fechaEntrega,
      createdAt: now,
      updatedAt: now,
    };
    setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => {
        if (t.id !== id) return t;
        let next: Task = { ...t, ...patch, updatedAt: new Date().toISOString() };
        if (patch.estado && patch.estado !== t.estado) {
          next.fechaEntrega =
            patch.estado === "Completada"
              ? (patch.fechaEntrega ?? t.fechaEntrega ?? todayISO())
              : null;
        }
        return next;
      }),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== id),
      puntos: d.puntos.filter((p) => p.taskId !== id),
    }));
  }, []);

  const addSemana = useCallback((mondayIso: string) => {
    setData((d) =>
      d.semanas.includes(mondayIso) ? d : { ...d, semanas: [...d.semanas, mondayIso] },
    );
  }, []);

  const createPunto = useCallback(
    (semana: string, input: Omit<AttentionPoint, "id" | "semana" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const punto: AttentionPoint = {
        id: newId(),
        semana,
        ...input,
        createdAt: now,
        updatedAt: now,
      };
      setData((d) => ({ ...d, puntos: [...d.puntos, punto] }));
    },
    [],
  );

  const updatePunto = useCallback((id: string, patch: Partial<AttentionPoint>) => {
    setData((d) => ({
      ...d,
      puntos: d.puntos.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
      ),
    }));
  }, []);

  const deletePunto = useCallback((id: string) => {
    setData((d) => ({ ...d, puntos: d.puntos.filter((p) => p.id !== id) }));
  }, []);

  return { data, user, hydrated, createPunto, updatePunto, deletePunto, setUser, createTask, updateTask, deleteTask, addSemana };
}
