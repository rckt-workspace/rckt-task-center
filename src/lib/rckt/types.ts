export const COLABORADORES = [
  "Anyely Huelgos",
  "Jaime Cardona",
  "Mariana Cano",
  "Daniel Mendez",
] as const;

export const CLIENTES = [
  "La Voz estratégica",
  "La Cuisine Appliances Colombia",
  "Grill Brothers",
  "Miel Dalí",
  "Magda - HEOR",
  "Newbody COL",
] as const;

export const AREAS = [
  "AI & Data Engineer",
  "Shopify & Frontend Developer",
  "Performance y campañas",
  "Performance Creative",
  "Project Manager",
] as const;

export const ESTADOS = ["Completada", "En curso", "Pendiente"] as const;

export const TIPOS_ATENCION = ["Decisión CEO", "Pendiente cliente", "En gestión"] as const;

export type Colaborador = string;
export type Cliente = string;
export type Area = string;
export type Estado = (typeof ESTADOS)[number];
export type TipoAtencion = (typeof TIPOS_ATENCION)[number];

export const COORDINADORA = "Coordinadora";
export type Identidad = string;

export type Rol = "admin" | "colaborador";

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  cargo: string;
}

export interface Task {
  id: string;
  /** Lunes de la semana, formato ISO yyyy-MM-dd */
  semana: string;
  /** uuid del perfil asignado */
  assignedTo: string;
  /** nombre visible del perfil asignado */
  colaborador: Colaborador;
  area: Area;
  cliente: Cliente;
  tarea: string;
  estado: Estado;
  /** yyyy-MM-dd */
  fechaLimite: string;
  /** HH:mm (24h) | null */
  horaLimite: string | null;
  /** yyyy-MM-dd | null */
  fechaEntrega: string | null;
  observaciones: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttentionPoint {
  id: string;
  semana: string;
  cliente: Cliente;
  assignedTo: string;
  colaborador: Colaborador;
  taskId: string;
  tipo: TipoAtencion;
  motivo: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  tasks: Task[];
  /** Semanas abiertas manualmente (lunes ISO) */
  semanas: string[];
  puntos: AttentionPoint[];
}

/** Código corto y estable para mostrar en la tabla. */
export function taskCode(id: string): string {
  return `#${id.slice(-4).toUpperCase()}`;
}
