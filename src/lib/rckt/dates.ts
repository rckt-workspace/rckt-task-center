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

export function weekLabel(mondayIso: string): string {
  return `${formatCO(mondayIso)} – ${format(sundayOfISO(mondayIso), "dd/MM/yyyy")}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function isOverdue(fechaLimite: string, estado: string): boolean {
  return estado !== "Completada" && fechaLimite < todayISO();
}
