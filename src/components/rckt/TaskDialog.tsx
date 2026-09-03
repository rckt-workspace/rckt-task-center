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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "./DateField";
import { AREAS, CLIENTES, ESTADOS } from "@/lib/rckt/types";
import type { Area, Cliente, Colaborador, Estado, Task } from "@/lib/rckt/types";
import { todayISO } from "@/lib/rckt/dates";
import type { TaskInput } from "@/lib/rckt/useAppStore";

type Mode = "create" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  /** false = vista colaborador: solo estado, fecha de entrega y observaciones */
  canEditAll: boolean;
  task?: Task | null | undefined;
  defaultColaborador?: Colaborador | undefined;
  colaboradores?: string[] | undefined;
  /** Mapa nombre → cargo para mostrar el cargo junto al nombre */
  cargos?: Record<string, string> | undefined;
  onSubmit: (values: TaskInput) => void;
}

const emptyValues = (colaborador?: Colaborador): TaskInput => ({
  colaborador: colaborador ?? "",
  area: AREAS[0],
  cliente: CLIENTES[0],
  tarea: "",
  estado: "En curso",
  fechaLimite: "",
  fechaEntrega: null,
  observaciones: "",
});

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  canEditAll,
  task,
  defaultColaborador,
  colaboradores = [],
  cargos,
  onSubmit,
}: Props) {
  const [v, setV] = useState<TaskInput>(emptyValues(defaultColaborador));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const areaFromCargo = (nombre: string, fallback: Area): Area => {
      const cargo = cargos?.[nombre];
      return cargo && (AREAS as readonly string[]).includes(cargo) ? cargo : fallback;
    };
    if (task) {
      setV({
        colaborador: task.colaborador,
        area: areaFromCargo(task.colaborador, task.area),
        cliente: task.cliente,
        tarea: task.tarea,
        estado: task.estado,
        fechaLimite: task.fechaLimite,
        fechaEntrega: task.fechaEntrega,
        observaciones: task.observaciones,
      });
    } else {
      const base = emptyValues(defaultColaborador);
      base.area = areaFromCargo(base.colaborador, base.area);
      setV(base);
    }
  }, [open, task, defaultColaborador, cargos]);

  const setEstado = (estado: Estado) => {
    setV((prev) => ({
      ...prev,
      estado,
      fechaEntrega:
        estado === "Completada"
          ? (prev.fechaEntrega ?? todayISO())
          : task?.estado === "Completada" || prev.estado === "Completada"
            ? null
            : prev.fechaEntrega,
    }));
  };

  const submit = () => {
    if (!v.colaborador || !v.area || !v.cliente || !v.tarea.trim() || !v.fechaLimite) {
      setError("Colaborador, Área, Cliente, Tarea y Fecha límite son obligatorios.");
      return;
    }
    onSubmit({ ...v, tarea: v.tarea.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva tarea" : "Editar tarea"}</DialogTitle>
          <DialogDescription>
            {canEditAll
              ? "Completa la información de la tarea de la semana."
              : "Puedes actualizar estado, fecha de entrega y observaciones."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <Select
              value={v.colaborador}
              onValueChange={(x) => {
                const cargo = cargos?.[x];
                setV((prev) => ({
                  ...prev,
                  colaborador: x as Colaborador,
                  // Sincroniza el área con el cargo del colaborador seleccionado
                  area: cargo && (AREAS as readonly string[]).includes(cargo) ? cargo : prev.area,
                }));
              }}
              disabled={!canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c} value={c}>
                    {cargos?.[c] ? `${c} — ${cargos[c]}` : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cargos?.[v.colaborador] ? (
              <p className="text-xs text-muted-foreground">
                El área se completa con el cargo de esta persona.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Área</Label>
            <Select
              value={v.area}
              onValueChange={(x) => setV({ ...v, area: x as Area })}
              disabled={!canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select
              value={v.cliente}
              onValueChange={(x) => setV({ ...v, cliente: x as Cliente })}
              disabled={!canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENTES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={v.estado} onValueChange={(x) => setEstado(x as Estado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tarea / Entregable</Label>
            <Input
              value={v.tarea}
              onChange={(e) => setV({ ...v, tarea: e.target.value })}
              placeholder="Describe el entregable"
              disabled={!canEditAll}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha límite</Label>
            <DateField
              value={v.fechaLimite || null}
              onChange={(iso) => setV({ ...v, fechaLimite: iso ?? "" })}
              disabled={!canEditAll}
            />
            {canEditAll ? (
              <p className="text-xs text-muted-foreground">
                La tarea se asigna automáticamente a la semana de esta fecha.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de entrega</Label>
            <DateField
              value={v.fechaEntrega}
              onChange={(iso) => setV({ ...v, fechaEntrega: iso })}
              clearable
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={3}
              value={v.observaciones}
              onChange={(e) => setV({ ...v, observaciones: e.target.value })}
              placeholder="Notas, bloqueos o contexto"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{mode === "create" ? "Crear tarea" : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
