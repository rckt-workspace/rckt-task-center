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
] as const;

export const ESTADOS = ["Completada", "En curso", "Pendiente"] as const;

export const TIPOS_ATENCION = ["Decisión CEO", "Pendiente cliente", "En gestión"] as const;

export type Colaborador = (typeof COLABORADORES)[number];
export type Cliente = (typeof CLIENTES)[number];
export type Area = (typeof AREAS)[number];
export type Estado = (typeof ESTADOS)[number];
export type TipoAtencion = (typeof TIPOS_ATENCION)[number];

/** Identidad activa: "Coordinadora" o el nombre de un colaborador. */
export const COORDINADORA = "Coordinadora";
export type Identidad = typeof COORDINADORA | Colaborador;

export interface Task {
  id: string;
  /** Lunes de la semana, formato ISO yyyy-MM-dd */
  semana: string;
  colaborador: Colaborador;
  area: Area;
  cliente: Cliente;
  tarea: string;
  estado: Estado;
  /** yyyy-MM-dd */
  fechaLimite: string;
  /** yyyy-MM-dd | null */
  fechaEntrega: string | null;
  observaciones: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  tasks: Task[];
  /** Semanas creadas manualmente (lunes ISO) */
  semanas: string[];
}
