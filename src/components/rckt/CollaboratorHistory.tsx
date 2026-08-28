import type { Task } from "@/lib/rckt/types";
import { computeStats } from "./StatsBar";
import { cn } from "@/lib/utils";

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
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

export function CollaboratorHistory({ tasks }: { tasks: Task[] }) {
  const global = useMemo(() => computeStats(tasks), [tasks]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Histórico acumulado</h2>
        <p className="text-sm text-muted-foreground">
          Todas las tareas registradas en todas las semanas
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total tareas" value={global.total} />
        <Stat label="Completadas" value={global.completadas} tone="success" />
        <Stat label="En curso" value={global.enCurso} tone="info" />
        <Stat label="Pendientes" value={global.pendientes} tone="warn" />
        <Stat label="Cumplimiento" value={`${global.cumplimiento}%`} />
        <Stat label="Vencidas" value={global.vencidas} tone="overdue" />
      </div>
    </section>
  );
}
