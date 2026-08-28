import { useMemo } from "react";
import { weekLabel } from "@/lib/rckt/dates";
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

  const byWeek = useMemo(() => {
    const weeks = [...new Set(tasks.map((t) => t.semana))].sort().reverse();
    return weeks.map((w) => {
      const list = tasks.filter((t) => t.semana === w);
      return { semana: w, ...computeStats(list) };
    });
  }, [tasks]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Histórico acumulado</h2>
        <p className="text-sm text-muted-foreground">
          Todas tus tareas registradas en todas las semanas
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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-panel">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Resumen semana por semana</h3>
        </div>
        {byWeek.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Aún no tienes tareas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 font-medium">Semana</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  <th className="px-4 py-2.5 text-right font-medium">Completadas</th>
                  <th className="px-4 py-2.5 text-right font-medium">En curso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pendientes</th>
                  <th className="px-4 py-2.5 text-right font-medium">Vencidas</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {byWeek.map((w) => (
                  <tr key={w.semana} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">{weekLabel(w.semana)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{w.total}</td>
                    <td className="px-4 py-2.5 text-right text-success">{w.completadas}</td>
                    <td className="px-4 py-2.5 text-right text-info">{w.enCurso}</td>
                    <td className="px-4 py-2.5 text-right text-warn">{w.pendientes}</td>
                    <td className="px-4 py-2.5 text-right text-overdue">{w.vencidas}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{w.cumplimiento}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
