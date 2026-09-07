import { AlertTriangle, ClipboardList, Eye, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { PersonChip } from "./PersonAvatar";
import { AreaTag, ClienteTag } from "./EntityTags";
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
import { TaskAttachments } from "./TaskAttachments";
import { formatCO, formatFechaHora, isOverdue, weekLabel } from "@/lib/rckt/dates";
import type { Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Props {
  tasks: Task[];
  showColaborador?: boolean | undefined;
  showSemana?: boolean | undefined;
  onEdit?: ((task: Task) => void) | undefined;
  onOpen?: ((task: Task) => void) | undefined;
  onDelete?: ((task: Task) => void) | undefined;
}

export function TaskTable({ tasks, showColaborador = false, showSemana = false, onEdit, onOpen, onDelete }: Props) {
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
              {showSemana ? <TableHead>Semana</TableHead> : null}
              {showColaborador ? <TableHead>Colaborador</TableHead> : null}
              <TableHead>Cliente</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="min-w-[240px]">Tarea / Entregable</TableHead>
              <TableHead>Fecha límite</TableHead>
              <TableHead>Fecha de entrega</TableHead>
              <TableHead className="min-w-[180px]">Descripción</TableHead>
              <TableHead className="min-w-[160px]">Adjuntos</TableHead>
              <TableHead className="w-[200px] text-right">Acción</TableHead>
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
                  <TableCell>
                    <EstadoBadge estado={t.estado} />
                  </TableCell>
                  {showSemana ? (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {weekLabel(t.semana)}
                    </TableCell>
                  ) : null}
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
                      {formatFechaHora(t.fechaLimite, t.horaLimite)}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatCO(t.fechaEntrega)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {t.observaciones || "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <TaskAttachments adjuntos={t.adjuntos} enlaces={t.enlaces} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {onOpen ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-1 gap-1.5"
                        onClick={() => onOpen(t)}
                      >
                        <Eye className="size-3.5" />
                        Abrir tarea
                      </Button>
                    ) : null}
                    {onEdit ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar tarea"
                        onClick={() => onEdit(t)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : null}
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
                  <EstadoBadge estado={t.estado} />
                </div>
                <div className="-mt-1 -mr-2 flex">
                  {onEdit ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar tarea"
                      onClick={() => onEdit(t)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  ) : null}
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
              {onOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() => onOpen(t)}
                >
                  <Eye className="size-3.5" />
                  Abrir tarea
                </Button>
              ) : null}
              <p className="mt-1 text-sm text-muted-foreground">
                {t.cliente} · {t.area}
                {showColaborador ? ` · ${t.colaborador}` : ""}
                {showSemana ? ` · Semana ${weekLabel(t.semana)}` : ""}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Fecha límite</dt>
                  <dd className={cn(overdue && "font-medium text-overdue")}>
                    {formatFechaHora(t.fechaLimite, t.horaLimite)}
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
              {t.adjuntos.length > 0 || t.enlaces.length > 0 ? (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="mb-1 text-xs text-muted-foreground">Adjuntos y enlaces</p>
                  <TaskAttachments adjuntos={t.adjuntos} enlaces={t.enlaces} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
