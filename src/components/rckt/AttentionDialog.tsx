import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPOS_ATENCION } from "@/lib/rckt/types";
import type { AttentionPoint, Task, TipoAtencion } from "@/lib/rckt/types";

export interface AttentionInput {
  taskId: string;
  tipo: TipoAtencion;
  motivo: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weekTasks: Task[];
  punto?: AttentionPoint | null | undefined;
  onSubmit: (values: AttentionInput) => void;
}

export function AttentionDialog({ open, onOpenChange, weekTasks, punto, onSubmit }: Props) {
  const [taskId, setTaskId] = useState("");
  const [tipo, setTipo] = useState<TipoAtencion>(TIPOS_ATENCION[0]);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setTaskId(punto?.taskId ?? "");
    setTipo(punto?.tipo ?? TIPOS_ATENCION[0]);
    setMotivo(punto?.motivo ?? "");
  }, [open, punto]);

  const task = weekTasks.find((t) => t.id === taskId);

  const submit = () => {
    if (!taskId || !motivo.trim()) {
      setError("Selecciona la tarea afectada y describe el motivo o acción requerida.");
      return;
    }
    onSubmit({ taskId, tipo, motivo: motivo.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{punto ? "Editar punto de atención" : "Nuevo punto de atención"}</DialogTitle>
          <DialogDescription>
            El cliente y el colaborador se toman de la tarea afectada de esta semana.
          </DialogDescription>
        </DialogHeader>

        {weekTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Primero crea tareas en esta semana para poder registrar puntos de atención.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Tarea afectada</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una tarea de la semana" />
                </SelectTrigger>
                <SelectContent>
                  {weekTasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.tarea} — {t.cliente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm">
                  {task?.cliente ?? "—"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Colaborador</Label>
                <p className="rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm">
                  {task?.colaborador ?? "—"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(x) => setTipo(x as TipoAtencion)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ATENCION.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo / Acción requerida</Label>
              <Textarea
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Describe la decisión o acción necesaria"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={weekTasks.length === 0}>
            {punto ? "Guardar cambios" : "Registrar punto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
