import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoBadge } from "./EstadoBadge";
import { formatCO, isOverdue } from "@/lib/rckt/dates";
import { taskCode, type Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  showColaborador?: boolean | undefined;
  onEdit: (task: Task) => void;
  onDelete?: ((task: Task) => void) | undefined;
}

export function TaskTable({ tasks, showColaborador = false, onEdit, onDelete }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">No hay tareas que coincidan con esta semana y filtros.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-panel lg:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/70 hover:bg-secondary/70">
              <TableHead className="w-[120px]">Estado</TableHead>
              {showColaborador ? <TableHead>Colaborador</TableHead> : null}
              <TableHead>Cliente</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="min-w-[240px]">Tarea / Entregable</TableHead>
              <TableHead>Fecha límite</TableHead>
              <TableHead>Fecha de entrega</TableHead>
              <TableHead className="min-w-[180px]">Observaciones</TableHead>
              <TableHead className="w-[90px] text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((t) => {
              const overdue = isOverdue(t.fechaLimite, t.estado);
              return (
                <TableRow
                  key={t.id}
                  className={cn(overdue && "bg-overdue-soft/70 hover:bg-overdue-soft")}
                >
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {taskCode(t.id)}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={t.estado} />
                  </TableCell>
                  {showColaborador ? (
                    <TableCell className="whitespace-nowrap">{t.colaborador}</TableCell>
                  ) : null}
                  <TableCell>{t.cliente}</TableCell>
                  <TableCell className="text-muted-foreground">{t.area}</TableCell>
                  <TableCell className="font-medium">{t.tarea}</TableCell>
                  <TableCell
                    className={cn("whitespace-nowrap", overdue && "font-medium text-overdue")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {overdue ? <AlertTriangle className="size-3.5" /> : null}
                      {formatCO(t.fechaLimite)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatCO(t.fechaEntrega)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.observaciones || "—"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar tarea"
                      onClick={() => onEdit(t)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {onDelete ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar tarea"
                        onClick={() => onDelete(t)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Móvil / tablet */}
      <div className="space-y-3 lg:hidden">
        {tasks.map((t) => {
          const overdue = isOverdue(t.fechaLimite, t.estado);
          return (
            <article
              key={t.id}
              className={cn(
                "rounded-lg border border-border bg-card p-4 shadow-panel",
                overdue && "border-overdue/40 bg-overdue-soft/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{taskCode(t.id)}</span>
                  <EstadoBadge estado={t.estado} />
                </div>
                <div className="-mt-1 -mr-2 flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar tarea"
                    onClick={() => onEdit(t)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar tarea"
                      onClick={() => onDelete(t)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 font-medium">{t.tarea}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.cliente} · {t.area}
                {showColaborador ? ` · ${t.colaborador}` : ""}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha límite</dt>
                  <dd className={cn(overdue && "font-medium text-overdue")}>
                    {formatCO(t.fechaLimite)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha de entrega</dt>
                  <dd>{formatCO(t.fechaEntrega)}</dd>
                </div>
              </dl>
              {t.observaciones ? (
                <p className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">
                  {t.observaciones}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
