import { useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardList, GripVertical } from "lucide-react";
import { EstadoBadge } from "./EstadoBadge";
import { EmptyState } from "./EmptyState";
import { PersonChip } from "./PersonAvatar";
import { ClienteTag } from "./EntityTags";
import { formatFechaHora, isOverdue } from "@/lib/rckt/dates";

import type { Estado, Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  showColaborador?: boolean | undefined;
  onOpen: (task: Task) => void;
  onChangeEstado: (task: Task, estado: Estado) => void | Promise<void>;
}

const COLUMN_ORDER: Estado[] = ["Pendiente", "En curso", "Completada"];

const columnAccent: Record<Estado, string> = {
  Pendiente: "border-t-warn",
  "En curso": "border-t-info",
  Completada: "border-t-success",
};

/** Tablero Kanban con arrastrar y soltar nativo (HTML5 DnD). */
export function KanbanBoard({ tasks, showColaborador = false, onOpen, onChangeEstado }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Estado | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const byEstado = (estado: Estado) =>
    tasks
      .filter((t) => t.estado === estado)
      .sort((a, b) => (a.fechaLimite < b.fechaLimite ? -1 : a.fechaLimite > b.fechaLimite ? 1 : 0));

  const drop = async (estado: Estado) => {
    const id = draggingId;
    setOverCol(null);
    setDraggingId(null);
    if (!id) return;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.estado === estado) return;
    setBusyId(id);
    try {
      await onChangeEstado(task, estado);
    } finally {
      setBusyId(null);
    }
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Tablero en blanco"
        description="No hay tareas que coincidan con esta semana y filtros."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMN_ORDER.map((estado) => {
        const items = byEstado(estado);
        const active = overCol === estado && draggingId !== null;
        return (
          <section
            key={estado}
            aria-label={`Columna ${estado}`}
            className={cn(
              "flex min-h-[280px] flex-col rounded-lg border border-border border-t-4 bg-secondary/40 transition-colors",
              columnAccent[estado],
              active && "bg-primary/5 ring-2 ring-primary/40",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overCol !== estado) setOverCol(estado);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverCol(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void drop(estado);
            }}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <EstadoBadge estado={estado} />
              <span className="text-xs font-medium text-muted-foreground">{items.length}</span>
            </header>
            <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {items.map((t) => {
                const overdue = isOverdue(t.fechaLimite, t.estado);
                const dragging = draggingId === t.id;
                const busy = busyId === t.id;
                return (
                  <li key={t.id}>
                    <article
                      role="button"
                      tabIndex={0}
                      draggable={!busy}
                      aria-label={`Abrir tarea ${t.tarea}`}
                      onClick={() => onOpen(t)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpen(t);
                        }
                      }}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.id);
                        setDraggingId(t.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverCol(null);
                      }}
                      className={cn(
                        "group cursor-grab rounded-md border border-border bg-card p-3 shadow-panel transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        dragging && "opacity-40",
                        busy && "pointer-events-none opacity-60",
                        overdue && "border-overdue/40 bg-overdue-soft/60",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{t.tarea}</p>
                          <ClienteTag
                            cliente={t.cliente}
                            className="mt-1 text-xs text-muted-foreground"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-muted-foreground",
                                overdue && "font-medium text-overdue",
                              )}
                            >
                              {overdue ? (
                                <AlertTriangle className="size-3.5" />
                              ) : (
                                <CalendarClock className="size-3.5" />
                              )}
                              {formatFechaHora(t.fechaLimite, t.horaLimite)}
                            </span>
                            {showColaborador ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <User className="size-3.5" />
                                {t.colaborador}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
              {items.length === 0 ? (
                <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-border/70 py-6 text-xs text-muted-foreground">
                  Arrastra una tarjeta aquí
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
