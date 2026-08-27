import type { AppData, AttentionPoint, Identidad, Task } from "./types";

const DATA_KEY = "rckt.control-semanal.data.v1";
const USER_KEY = "rckt.control-semanal.user.v1";

const EMPTY: AppData = { tasks: [], semanas: [], puntos: [] };

/**
 * Capa de persistencia. Hoy usa localStorage; al conectar Supabase
 * basta con reemplazar la implementación de estas funciones.
 */
export function loadData(): AppData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(DATA_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      tasks: Array.isArray(parsed.tasks) ? (parsed.tasks as Task[]) : [],
      semanas: Array.isArray(parsed.semanas) ? (parsed.semanas as string[]) : [],
      puntos: Array.isArray(parsed.puntos) ? (parsed.puntos as AttentionPoint[]) : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {
    /* storage lleno o no disponible */
  }
}

export function loadUser(): Identidad | null {
  if (typeof window === "undefined") return null;
  return (window.localStorage.getItem(USER_KEY) as Identidad | null) ?? null;
}

export function saveUser(user: Identidad | null): void {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, user);
  else window.localStorage.removeItem(USER_KEY);
}

export function newId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
