import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, Filter, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IdentityGate } from "@/components/rckt/IdentityGate";
import { StatsBar } from "@/components/rckt/StatsBar";
import { TaskTable } from "@/components/rckt/TaskTable";
import { TaskDialog } from "@/components/rckt/TaskDialog";
import { WeekPicker } from "@/components/rckt/WeekPicker";
import { DateField } from "@/components/rckt/DateField";
import { SummaryTable } from "@/components/rckt/SummaryTables";
import { AttentionPoints } from "@/components/rckt/AttentionPoints";
import { AttentionDialog, type AttentionInput } from "@/components/rckt/AttentionDialog";
import { CollaboratorHistory } from "@/components/rckt/CollaboratorHistory";
import { useAppStore, type TaskInput } from "@/lib/rckt/useAppStore";
import { currentWeekISO, mondayOf, toISO, weekLabel } from "@/lib/rckt/dates";
import {
  AREAS,
  CLIENTES,
  COLABORADORES,
  COORDINADORA,
  ESTADOS,
  type AttentionPoint,
  type Task,
} from "@/lib/rckt/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Centro de Control Semanal RCKT" },
      {
        name: "description",
        content:
          "Panel interno RCKT para planear, asignar y hacer seguimiento semanal de tareas por colaborador, cliente y área.",
      },
      { property: "og:title", content: "Centro de Control Semanal RCKT" },
      {
        property: "og:description",
        content: "Seguimiento semanal de tareas por colaborador, cliente y área.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ALL = "__all__";

function Index() {
  const store = useAppStore();
  const [semana, setSemana] = useState<string>(currentWeekISO());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [newWeek, setNewWeek] = useState<string | null>(null);
  const [fColab, setFColab] = useState<string>(ALL);
  const [fCliente, setFCliente] = useState<string>(ALL);
  const [fArea, setFArea] = useState<string>(ALL);
  const [fEstado, setFEstado] = useState<string>(ALL);
  const [puntoOpen, setPuntoOpen] = useState(false);
  const [editingPunto, setEditingPunto] = useState<AttentionPoint | null>(null);
  const [deletingPunto, setDeletingPunto] = useState<AttentionPoint | null>(null);

  const user = store.user;
  const isCoord = user === COORDINADORA;
  const isPastWeek = semana < currentWeekISO();

  /** Todas las tareas de la semana visibles para la identidad actual (sin filtros). */
  const scopeTasks = useMemo(() => {
    const list = store.data.tasks.filter((t) => t.semana === semana);
    return isCoord ? list : list.filter((t) => t.colaborador === user);
  }, [store.data.tasks, semana, isCoord, user]);

  const weekTasks = useMemo(() => {
    let list = scopeTasks;
    if (!isCoord) return list;
    if (fColab !== ALL) list = list.filter((t) => t.colaborador === fColab);
    if (fCliente !== ALL) list = list.filter((t) => t.cliente === fCliente);
    if (fArea !== ALL) list = list.filter((t) => t.area === fArea);
    if (fEstado !== ALL) list = list.filter((t) => t.estado === fEstado);
    return list;
  }, [scopeTasks, isCoord, fColab, fCliente, fArea, fEstado]);

  const puntos = useMemo(
    () => store.data.puntos.filter((p) => p.semana === semana),
    [store.data.puntos, semana],
  );

  /** Tareas abiertas (Pendiente/En curso) del colaborador en semanas anteriores a la actual. */
  const backlogTasks = useMemo(() => {
    if (isCoord) return [];
    const current = currentWeekISO();
    return store.data.tasks
      .filter(
        (t) =>
          t.colaborador === user && t.semana < current && t.estado !== "Completada",
      )
      .sort((a, b) => (a.semana < b.semana ? -1 : 1));
  }, [store.data.tasks, isCoord, user]);

  const abiertas = scopeTasks.filter((t) => t.estado !== "Completada").length;
  const current = currentWeekISO();
  const availableWeeks = useMemo(
    () =>
      [...new Set([...store.data.semanas, ...store.data.tasks.map((t) => t.semana), current])]
        .sort()
        .reverse(),
    [store.data.semanas, store.data.tasks, current],
  );
  const weekLabels = useMemo(
    () =>
      Object.fromEntries(
        availableWeeks.map((w) => [w, w === current ? `${weekLabel(w)} · Actual` : weekLabel(w)]),
      ),
    [availableWeeks, current],
  );
  const hasFilters =
    semana !== current || fColab !== ALL || fCliente !== ALL || fArea !== ALL || fEstado !== ALL;

  if (!store.hydrated) {
    return <div className="min-h-screen" />;
  }

  if (!user) {
    return <IdentityGate onSelect={store.setUser} />;
  }

  const handleSubmit = (values: TaskInput) => {
    if (editing) {
      store.updateTask(editing.id, values);
      toast.success("Tarea actualizada");
    } else {
      store.createTask(semana, values);
      toast.success("Tarea creada");
    }
    setEditing(null);
  };

  const handlePunto = (values: AttentionInput) => {
    const task = scopeTasks.find((t) => t.id === values.taskId);
    if (!task) {
      toast.error("La tarea seleccionada ya no existe");
      return;
    }
    const payload = {
      taskId: task.id,
      tipo: values.tipo,
      motivo: values.motivo,
      cliente: task.cliente,
      colaborador: task.colaborador,
    };
    if (editingPunto) {
      store.updatePunto(editingPunto.id, payload);
      toast.success("Punto de atención actualizado");
    } else {
      store.createPunto(semana, payload);
      toast.success("Punto de atención registrado");
    }
    setEditingPunto(null);
  };

  const clearFilters = () => {
    setSemana(currentWeekISO());
    setFColab(ALL);
    setFCliente(ALL);
    setFArea(ALL);
    setFEstado(ALL);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="mr-auto">
            <p className="font-display text-[11px] font-semibold tracking-[0.2em] text-accent-foreground uppercase">
              RCKT
            </p>
            <h1 className="text-lg font-semibold">Centro de Control Semanal</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{user}</p>
            <p className="text-xs text-muted-foreground">
              {isCoord ? "Coordinadora" : "Colaborador"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => store.setUser(null)} className="gap-2">
            <RefreshCw className="size-3.5" />
            Cambiar usuario
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 sm:px-6">
        <section className="flex flex-wrap items-center gap-3">
          <WeekPicker value={semana} onChange={setSemana} />
          {semana !== currentWeekISO() ? (
            <Button variant="ghost" size="sm" onClick={() => setSemana(currentWeekISO())}>
              Ir a semana actual
            </Button>
          ) : null}
          {isCoord ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <DateField
                  value={newWeek}
                  onChange={(iso) =>
                    setNewWeek(iso ? toISO(mondayOf(new Date(iso + "T00:00:00"))) : null)
                  }
                  placeholder="Crear semana"
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!newWeek}
                  onClick={() => {
                    if (!newWeek) return;
                    store.addSemana(newWeek);
                    setSemana(newWeek);
                    setNewWeek(null);
                    toast.success("Semana abierta");
                  }}
                >
                  <CalendarPlus className="size-4" />
                  Abrir semana
                </Button>
              </div>
              <Button
                className="gap-2"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-4" />
                Nueva tarea
              </Button>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <h2 className="sr-only">Resumen de la semana</h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">Semana del {weekLabel(semana)}</p>
            {isPastWeek ? (
              <span className="inline-flex items-center rounded-full border border-warn/25 bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
                Semana anterior · {abiertas} tarea{abiertas === 1 ? "" : "s"} sin cerrar
              </span>
            ) : null}
          </div>
          <StatsBar tasks={weekTasks} />
        </section>

        {isCoord ? <CollaboratorHistory tasks={store.data.tasks} /> : null}

        {isCoord ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <SummaryTable
              title="Resumen por cliente"
              tasks={scopeTasks}
              field="cliente"
              selected={fCliente === ALL ? null : fCliente}
              onSelect={(v) => setFCliente(v ?? ALL)}
            />
            <SummaryTable
              title="Resumen por colaborador"
              tasks={scopeTasks}
              field="colaborador"
              selected={fColab === ALL ? null : fColab}
              onSelect={(v) => setFColab(v ?? ALL)}
            />
          </section>
        ) : null}

        {isCoord ? (
          <AttentionPoints
            puntos={puntos}
            tasks={store.data.tasks}
            onCreate={() => {
              setEditingPunto(null);
              setPuntoOpen(true);
            }}
            onEdit={(p) => {
              setEditingPunto(p);
              setPuntoOpen(true);
            }}
            onDelete={(p) => setDeletingPunto(p)}
          />
        ) : null}

        {isCoord ? (
          <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-panel">
            <Filter className="size-4 text-muted-foreground" />
            <FilterSelect
              value={semana}
              onChange={setSemana}
              placeholder="Semana"
              options={availableWeeks}
              labels={weekLabels}
              showAll={false}
            />
            <FilterSelect
              value={fColab}
              onChange={setFColab}
              placeholder="Colaborador"
              options={[...COLABORADORES]}
            />
            <FilterSelect
              value={fCliente}
              onChange={setFCliente}
              placeholder="Cliente"
              options={[...CLIENTES]}
            />
            <FilterSelect value={fArea} onChange={setFArea} placeholder="Área" options={[...AREAS]} />
            <FilterSelect
              value={fEstado}
              onChange={setFEstado}
              placeholder="Estado"
              options={[...ESTADOS]}
            />
            {hasFilters ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
                <X className="size-3.5" />
                Limpiar filtros
              </Button>
            ) : null}
          </section>
        ) : null}

        {!isCoord && backlogTasks.length > 0 ? (
          <section className="rounded-xl border border-warn/40 bg-warn-soft p-4 shadow-panel">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-warn" />
              <h2 className="text-base font-semibold text-warn">
                Tareas sin cerrar de semanas anteriores ({backlogTasks.length})
              </h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              Estas tareas siguen pendientes o en curso. Actualízalas para sacarlas de esta lista.
            </p>
            <TaskTable
              tasks={backlogTasks}
              showColaborador={false}
              showSemana
              onEdit={(t) => {
                setEditing(t);
                setDialogOpen(true);
              }}
            />
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-base font-semibold">
            {isCoord ? "Todas las tareas" : "Mis tareas"}
          </h2>
          <TaskTable
            tasks={weekTasks}
            showColaborador={isCoord}
            onEdit={(t) => {
              setEditing(t);
              setDialogOpen(true);
            }}
            onDelete={isCoord ? (t) => setDeleting(t) : undefined}
          />
        </section>
      </main>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        mode={editing ? "edit" : "create"}
        canEditAll={isCoord}
        task={editing}
        defaultColaborador={isCoord ? undefined : (user as (typeof COLABORADORES)[number])}
        onSubmit={handleSubmit}
      />

      <AttentionDialog
        open={puntoOpen}
        onOpenChange={(o) => {
          setPuntoOpen(o);
          if (!o) setEditingPunto(null);
        }}
        weekTasks={scopeTasks}
        punto={editingPunto}
        onSubmit={handlePunto}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleting?.tarea}» de forma permanente, junto con sus puntos de
              atención.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) store.deleteTask(deleting.id);
                setDeleting(null);
                toast.success("Tarea eliminada");
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingPunto} onOpenChange={(o) => !o && setDeletingPunto(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este punto de atención?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deletingPunto?.motivo}» de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingPunto) store.deletePunto(deletingPunto.id);
                setDeletingPunto(null);
                toast.success("Punto de atención eliminado");
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  labels,
  showAll = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labels?: Record<string, string>;
  showAll?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[190px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showAll ? <SelectItem value={ALL}>Todos · {placeholder}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
