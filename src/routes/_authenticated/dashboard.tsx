import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  FileDown,
  FileSpreadsheet,
  Filter,
  History as HistoryIcon,
  LogOut,
  Plus,
  Users,
  X,
} from "lucide-react";
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
import { StatsBar } from "@/components/rckt/StatsBar";
import { TaskTable } from "@/components/rckt/TaskTable";
import { TaskDialog } from "@/components/rckt/TaskDialog";
import { WeekPicker } from "@/components/rckt/WeekPicker";
import { DateField } from "@/components/rckt/DateField";
import { SummaryTable } from "@/components/rckt/SummaryTables";
import { AttentionPoints } from "@/components/rckt/AttentionPoints";
import { AttentionDialog, type AttentionInput } from "@/components/rckt/AttentionDialog";
import { supabase } from "@/integrations/supabase/client";

import { useAppStore, semanaDeFechaLimite, type TaskInput } from "@/lib/rckt/useAppStore";
import {
  exportMyTasksExcel,
  exportMyTasksPDF,
  exportTasksExcel,
  exportTasksPDF,
} from "@/lib/rckt/exporters";
import { currentWeekISO, mondayOf, toISO, weekLabel } from "@/lib/rckt/dates";
import { AREAS, CLIENTES, ESTADOS, type AttentionPoint, type Task } from "@/lib/rckt/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel semanal · Centro de Control RCKT" },
      {
        name: "description",
        content:
          "Panel interno RCKT para planear, asignar y hacer seguimiento semanal de tareas por colaborador, cliente y área.",
      },
      { property: "og:title", content: "Panel semanal · Centro de Control RCKT" },
      {
        property: "og:description",
        content: "Seguimiento semanal de tareas por colaborador, cliente y área.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const ALL = "__all__";

function Dashboard() {
  const store = useAppStore();
  const navigate = useNavigate();
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
  const [historico, setHistorico] = useState(false);

  const isCoord = store.isAdmin;
  const nombre = store.perfil?.nombre ?? store.session?.user.email ?? "";
  const isPastWeek = !historico && semana < currentWeekISO();
  const colaboradores = useMemo(() => store.profiles.map((p) => p.nombre), [store.profiles]);
  const cargos = useMemo(
    () =>
      Object.fromEntries(
        store.profiles.filter((p) => p.cargo).map((p) => [p.nombre, p.cargo]),
      ) as Record<string, string>,
    [store.profiles],
  );

  const scopeTasks = useMemo(
    () => (historico ? store.data.tasks : store.data.tasks.filter((t) => t.semana === semana)),
    [store.data.tasks, semana, historico],
  );

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
    () => (historico ? store.data.puntos : store.data.puntos.filter((p) => p.semana === semana)),
    [store.data.puntos, semana, historico],
  );

  const backlogTasks = useMemo(() => {
    if (isCoord) return [];
    const current = currentWeekISO();
    return store.data.tasks
      .filter((t) => t.semana < current && t.estado !== "Completada")
      .sort((a, b) => (a.semana < b.semana ? -1 : 1));
  }, [store.data.tasks, isCoord]);

  const abiertas = scopeTasks.filter((t) => t.estado !== "Completada").length;
  const current = currentWeekISO();
  const hasFilters =
    historico ||
    semana !== current ||
    fColab !== ALL ||
    fCliente !== ALL ||
    fArea !== ALL ||
    fEstado !== ALL;

  if (!store.hydrated) {
    return <div className="min-h-screen" />;
  }

  const handleSubmit = async (values: TaskInput) => {
    const uploading = values.nuevosArchivos.length;
    const toastOpts =
      uploading > 0
        ? { id: toast.loading(`Subiendo ${uploading} archivo${uploading === 1 ? "" : "s"}…`) }
        : {};
    try {
      const targetWeek = values.fechaLimite ? semanaDeFechaLimite(values.fechaLimite) : semana;
      const movesWeek = !historico && targetWeek !== semana;
      if (editing) {
        await store.updateTask(editing.id, values);
        toast.success(
          movesWeek ? `Tarea actualizada · se movió a la semana del ${weekLabel(targetWeek)}` : "Tarea actualizada",
          toastOpts,
        );
      } else {
        await store.createTask(semana, values);
        toast.success(
          movesWeek ? `Tarea creada en la semana del ${weekLabel(targetWeek)}` : "Tarea creada",
          toastOpts,
        );
      }
      if (movesWeek) setSemana(targetWeek);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la tarea", toastOpts);
    }
    setEditing(null);
  };

  const handlePunto = async (values: AttentionInput) => {
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
    try {
      if (editingPunto) {
        await store.updatePunto(editingPunto.id, payload);
        toast.success("Punto de atención actualizado");
      } else {
        await store.createPunto(semana, payload);
        toast.success("Punto de atención registrado");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el punto de atención");
    }
    setEditingPunto(null);
  };

  const clearFilters = () => {
    setHistorico(false);
    setSemana(currentWeekISO());
    setFColab(ALL);
    setFCliente(ALL);
    setFArea(ALL);
    setFEstado(ALL);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-header bg-header text-header-foreground">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
          <div className="mr-auto">
            <p className="font-display text-[11px] font-semibold tracking-[0.2em] text-header-foreground/70 uppercase">
              RCKT
            </p>
            <h1 className="text-lg font-semibold text-header-foreground">
              Centro de Control Semanal
            </h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{nombre}</p>
            <p className="text-xs text-header-foreground/70">
              {isCoord ? "Administradora" : "Colaborador"}
            </p>
          </div>
          {isCoord ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-2 border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/15 hover:text-header-foreground"
            >
              <Link to="/admin">
                <Users className="size-3.5" />
                Usuarios
              </Link>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="gap-2 border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/15 hover:text-header-foreground"
          >
            <LogOut className="size-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </header>


      <main className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 sm:px-6">
        <section className="flex flex-wrap items-center gap-3">
          <WeekPicker
            value={semana}
            onChange={(v) => {
              setHistorico(false);
              setSemana(v);
            }}
          />
          {isCoord ? (
            <Button
              variant={historico ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setHistorico((h) => !h)}
            >
              <HistoryIcon className="size-3.5" />
              {historico ? "Viendo histórico" : "Ver histórico"}
            </Button>
          ) : null}
          {!historico && semana !== currentWeekISO() ? (
            <Button variant="ghost" size="sm" onClick={() => setSemana(currentWeekISO())}>
              Ir a semana actual
            </Button>
          ) : null}
          {!isCoord ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  exportMyTasksPDF(scopeTasks, semana, nombre);
                  toast.success("PDF exportado");
                }}
              >
                <FileDown className="size-3.5" />
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  exportMyTasksExcel(scopeTasks, semana, nombre);
                  toast.success("Excel exportado");
                }}
              >
                <FileSpreadsheet className="size-3.5" />
                Exportar Excel
              </Button>
            </>
          ) : null}
          {isCoord ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  exportTasksPDF(scopeTasks, historico ? null : semana);
                  toast.success("PDF exportado");
                }}
              >
                <FileDown className="size-3.5" />
                Exportar PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  exportTasksExcel(scopeTasks, historico ? null : semana);
                  toast.success("Excel exportado");
                }}
              >
                <FileSpreadsheet className="size-3.5" />
                Exportar Excel
              </Button>
            </>
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
          <div>
            <h2 className="text-base font-semibold">
              {historico
                ? "Histórico acumulado"
                : `Semana ${semana === current ? "actual" : "seleccionada"}`}
            </h2>
            <p className="text-sm text-muted-foreground">
              {historico
                ? "Todas las tareas registradas en todas las semanas"
                : `Semana del ${weekLabel(semana)}`}
            </p>
          </div>
          {isPastWeek ? (
            <span className="inline-flex items-center rounded-full border border-warn/25 bg-warn-soft px-2.5 py-0.5 text-xs font-medium text-warn">
              Semana anterior · {abiertas} tarea{abiertas === 1 ? "" : "s"} sin cerrar
            </span>
          ) : null}
          <StatsBar tasks={weekTasks} />
        </section>

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
            <WeekPicker
              value={semana}
              onChange={(v) => {
                setHistorico(false);
                setSemana(v);
              }}
              className="w-auto"
            />
            <Button
              variant={historico ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setHistorico((h) => !h)}
            >
              <HistoryIcon className="size-3.5" />
              Histórico
            </Button>
            <FilterSelect
              value={fColab}
              onChange={setFColab}
              placeholder="Colaborador"
              options={colaboradores}
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
            {isCoord
              ? historico
                ? "Todas las tareas (histórico)"
                : "Todas las tareas"
              : "Mis tareas"}
          </h2>
          <TaskTable
            tasks={weekTasks}
            showColaborador={isCoord}
            showSemana={historico}
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
        colaboradores={colaboradores}
        cargos={cargos}
        defaultColaborador={isCoord ? undefined : nombre}
        currentUserName={nombre}
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
              onClick={async () => {
                const target = deleting;
                setDeleting(null);
                if (!target) return;
                try {
                  await store.deleteTask(target.id);
                  toast.success("Tarea eliminada");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
                }
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
              onClick={async () => {
                const target = deletingPunto;
                setDeletingPunto(null);
                if (!target) return;
                try {
                  await store.deletePunto(target.id);
                  toast.success("Punto de atención eliminado");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
                }
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[190px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Todos · {placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
