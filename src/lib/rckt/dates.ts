import { addDays, format, parseISO, startOfWeek } from "date-fns";

export const ISO = "yyyy-MM-dd";

export function toISO(date: Date): string {
  return format(date, ISO);
}

export function fromISO(iso: string): Date {
  return parseISO(iso);
}

/** Lunes de la semana de una fecha */
export function mondayOf(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function currentWeekISO(): string {
  return toISO(mondayOf(new Date()));
}

export function sundayOfISO(mondayIso: string): Date {
  return addDays(fromISO(mondayIso), 6);
}

/** DD/MM/YYYY */
export function formatCO(iso?: string | null): string {
  if (!iso) return "—";
  return format(fromISO(iso), "dd/MM/yyyy");
}

/** "HH:mm" (24h) → "3:00 PM" */
export function formatHora(hora?: string | null): string {
  if (!hora) return "";
  const [h = "0", m = "00"] = hora.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return format(d, "h:mm a");
}

/** DD/MM/YYYY + hora opcional: "15/09/2026, 3:00 PM" */
export function formatFechaHora(iso?: string | null, hora?: string | null): string {
  const f = formatCO(iso);
  const h = formatHora(hora);
  return h ? `${f}, ${h}` : f;
}

export function weekLabel(mondayIso: string): string {
  return `${formatCO(mondayIso)} – ${format(sundayOfISO(mondayIso), "dd/MM/yyyy")}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function isOverdue(fechaLimite: string, estado: string): boolean {
  return estado !== "Completada" && fechaLimite < todayISO();
}
