import { useState } from "react";
import { AlertTriangle, Download, ExternalLink, Link2, Loader2, Paperclip, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoBadge } from "./EstadoBadge";
import { AudioPlayer, fileIcon, formatSize, isAudio } from "./TaskAttachments";
import { TaskComments } from "./TaskComments";
import { TaskSteps } from "./TaskSteps";
import { getAttachmentDownloadUrl } from "@/lib/rckt/useAppStore";
import { formatCO, formatFechaHora, isOverdue, weekLabel } from "@/lib/rckt/dates";
import { ESTADOS } from "@/lib/rckt/types";
import type { Attachment, Estado, Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  isAdmin: boolean;
  currentUserName: string;
  /** Solo admin: abre el formulario de edición completa */
  onEdit?: ((task: Task) => void) | undefined;
  /** Colaborador: cambiar únicamente el estado de la tarea */
  onChangeEstado?: ((task: Task, estado: Estado) => void) | undefined;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function DownloadRow({ a }: { a: Attachment }) {
  const [busy, setBusy] = useState(false);
  const Icon = fileIcon(a.mime);
  const download = async () => {
    setBusy(true);
    try {
      const url = await getAttachmentDownloadUrl(a.path, a.name);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar el archivo");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.name}</p>
        <p className="text-xs text-muted-foreground">{formatSize(a.size)}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        disabled={busy}
        onClick={() => void download()}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        Descargar
      </Button>
    </li>
  );
}

/** Detalle completo de una tarea (solo lectura) con adjuntos, audio, enlaces y comentarios. */
export function TaskDetailDialog({ open, onOpenChange, task, isAdmin, currentUserName, onEdit }: Props) {
  if (!task) return null;
  const overdue = isOverdue(task.fechaLimite, task.estado);
  const audios = task.adjuntos.filter((a) => isAudio(a.mime, a.name));
  const files = task.adjuntos.filter((a) => !isAudio(a.mime, a.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <EstadoBadge estado={task.estado} />
            {overdue ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-overdue">
                <AlertTriangle className="size-3.5" /> Vencida
              </span>
            ) : null}
          </div>
          <DialogTitle className="text-lg leading-snug">{task.tarea}</DialogTitle>
          <DialogDescription>
            {task.cliente} · {task.area} · Semana del {weekLabel(task.semana)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-3">
            <Field label="Cliente">{task.cliente}</Field>
            <Field label="Área">{task.area}</Field>
            <Field label="Colaborador">{task.colaborador}</Field>
            <Field label="Fecha límite">
              <span className={cn(overdue && "font-medium text-overdue")}>
                {formatFechaHora(task.fechaLimite, task.horaLimite)}
              </span>
            </Field>
            <Field label="Fecha de entrega">{formatCO(task.fechaEntrega)}</Field>
            <Field label="Estado">{task.estado}</Field>
          </dl>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Descripción / entregable</h3>
            {task.observaciones ? (
              <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-background p-3 text-sm leading-relaxed text-foreground/90">
                {task.observaciones}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin descripción adicional.</p>
            )}
          </section>

          {audios.length > 0 ? (
            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Nota de voz</h3>
              <div className="space-y-2">
                {audios.map((a) => (
                  <AudioPlayer key={a.id} a={a} />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h3 className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <Paperclip className="size-3.5" /> Adjuntos
              {files.length > 0 ? (
                <span className="font-normal text-muted-foreground">({files.length})</span>
              ) : null}
            </h3>
            {files.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border bg-background">
                {files.map((a) => (
                  <DownloadRow key={a.id} a={a} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay archivos adjuntos.</p>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">
              <Link2 className="size-3.5" /> Enlaces
              {task.enlaces.length > 0 ? (
                <span className="font-normal text-muted-foreground">({task.enlaces.length})</span>
              ) : null}
            </h3>
            {task.enlaces.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border bg-background">
                {task.enlaces.map((url, i) => (
                  <li key={`${url}-${i}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-secondary/50 hover:underline"
                      title={url}
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay enlaces.</p>
            )}
          </section>

          <div className="grid gap-4">
            <TaskSteps taskId={task.id} readOnly={isAdmin} />
          </div>

          <div className="grid gap-4 border-t border-border pt-4">
            <TaskComments taskId={task.id} authorName={currentUserName} isAdmin={isAdmin} />
          </div>
        </div>

        <DialogFooter>
          {onEdit ? (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                onEdit(task);
              }}
            >
              <Pencil className="size-4" />
              {isAdmin ? "Editar tarea" : "Actualizar estado"}
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
