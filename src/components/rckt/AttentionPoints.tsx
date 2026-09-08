import { AlertOctagon, Clock, Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./EmptyState";
import { PersonAvatar } from "./PersonAvatar";
import { ClienteTag } from "./EntityTags";
import { TIPOS_ATENCION } from "@/lib/rckt/types";
import type { AttentionPoint, Task, TipoAtencion } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

const tipoStyles: Record<TipoAtencion, { chip: string; icon: typeof AlertOctagon }> = {
  "Decisión CEO": { chip: "bg-overdue-soft text-overdue border-overdue/25", icon: AlertOctagon },
  "Pendiente cliente": { chip: "bg-warn-soft text-warn border-warn/25", icon: Clock },
  "En gestión": { chip: "bg-info-soft text-info border-info/25", icon: UserCog },
};

interface Props {
  puntos: AttentionPoint[];
  tasks: Task[];
  onCreate: () => void;
  onEdit: (p: AttentionPoint) => void;
  onDelete: (p: AttentionPoint) => void;
  view?: "lista" | "tablero";
}

function PuntoRow({
  p,
  task,
  onEdit,
  onDelete,
}: {
  p: AttentionPoint;
  task?: Task | undefined;
  onEdit: (p: AttentionPoint) => void;
  onDelete: (p: AttentionPoint) => void;
}) {
  const { chip, icon: Icon } = tipoStyles[p.tipo];
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-background/60 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            chip,
          )}
        >
          <Icon className="size-3.5" />
          {p.tipo}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{task ? task.tarea : "Tarea no disponible"}</p>
          <p className="text-sm text-foreground/90">{p.motivo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <ClienteTag cliente={p.cliente} />
            <span className="inline-flex items-center gap-1.5">
              <PersonAvatar name={p.colaborador} size="xs" />
              {p.colaborador}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Editar punto de atención"
          onClick={() => onEdit(p)}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Eliminar punto de atención"
          onClick={() => onDelete(p)}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </article>
  );
}

export function AttentionPoints({ puntos, tasks, onCreate, onEdit, onDelete, view = "tablero" }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold">Puntos de atención</h2>
        <Button size="sm" variant="outline" className="ml-auto gap-2" onClick={onCreate}>
          <Plus className="size-4" />
          Nuevo punto
        </Button>
      </div>

      {puntos.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Semana sin puntos de atención"
          description="Nada bloqueado por ahora. Si algo requiere una decisión o espera al cliente, regístralo aquí."
        />
      ) : (
        view === "lista" ? (
          <div className="space-y-2">
            {TIPOS_ATENCION.flatMap((tipo) => puntos.filter((p) => p.tipo === tipo)).map((p) => (
              <PuntoRow
                key={p.id}
                p={p}
                task={tasks.find((t) => t.id === p.taskId)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {TIPOS_ATENCION.map((tipo) => {
              const items = puntos.filter((p) => p.tipo === tipo);
              const { chip, icon: Icon } = tipoStyles[tipo];
              return (
                <div
                  key={tipo}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-panel"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        chip,
                      )}
                    >
                      <Icon className="size-3.5" />
                      {tipo}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
                  </div>

                  {items.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">Sin puntos.</p>
                  ) : (
                    items.map((p) => {
                      const task = tasks.find((t) => t.id === p.taskId);
                      return (
                        <article
                          key={p.id}
                          className="rounded-lg border border-border bg-background/60 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">
                              {task ? task.tarea : "Tarea no disponible"}
                            </p>
                            <div className="-mt-1.5 -mr-2 flex shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Editar punto de atención"
                                onClick={() => onEdit(p)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Eliminar punto de atención"
                                onClick={() => onDelete(p)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <ClienteTag cliente={p.cliente} />
                            <span className="inline-flex items-center gap-1.5">
                              <PersonAvatar name={p.colaborador} size="xs" />
                              {p.colaborador}
                            </span>
                          </div>
                          <p className="mt-2 text-sm">{p.motivo}</p>
                        </article>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        )
      )}
    </section>
  );
}
