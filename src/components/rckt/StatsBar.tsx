import { isOverdue } from "@/lib/rckt/dates";
import type { Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

export function computeStats(tasks: Task[]) {
  const total = tasks.length;
  const completadas = tasks.filter((t) => t.estado === "Completada").length;
  const enCurso = tasks.filter((t) => t.estado === "En curso").length;
  const pendientes = tasks.filter((t) => t.estado === "Pendiente").length;
  const vencidas = tasks.filter((t) => isOverdue(t.fechaLimite, t.estado)).length;
  const cumplimiento = total === 0 ? 0 : Math.round((completadas / total) * 100);
  return { total, completadas, enCurso, pendientes, vencidas, cumplimiento };
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "info" | "warn" | "overdue" | "accent";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "info"
        ? "text-info"
        : tone === "warn"
          ? "text-warn"
          : tone === "overdue"
            ? "text-overdue"
            : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-panel">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className={cn("mt-1 font-display text-2xl leading-none font-semibold", toneClass)}>
        {value}
      </p>
    </div>
  );
}

export function StatsBar({ tasks }: { tasks: Task[] }) {
  const s = computeStats(tasks);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Total tareas" value={s.total} />
      <Stat label="Completadas" value={s.completadas} tone="success" />
      <Stat label="En curso" value={s.enCurso} tone="info" />
      <Stat label="Pendientes" value={s.pendientes} tone="warn" />
      <Stat label="Cumplimiento" value={`${s.cumplimiento}%`} tone="accent" />
      <Stat label="Vencidas" value={s.vencidas} tone="overdue" />
    </div>
  );
}
