import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarPlus, Filter, Plus, RefreshCw } from "lucide-react";
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
import { useAppStore, type TaskInput } from "@/lib/rckt/useAppStore";
import { currentWeekISO, mondayOf, toISO, weekLabel } from "@/lib/rckt/dates";
import {
  AREAS,
  CLIENTES,
  COLABORADORES,
  COORDINADORA,
  ESTADOS,
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

  const user = store.user;
  const isCoord = user === COORDINADORA;

  const weekTasks = useMemo(() => {
    let list = store.data.tasks.filter((t) => t.semana === semana);
    if (!isCoord) return list.filter((t) => t.colaborador === user);
    if (fColab !== ALL) list = list.filter((t) => t.colaborador === fColab);
    if (fCliente !== ALL) list = list.filter((t) => t.cliente === fCliente);
    if (fArea !== ALL) list = list.filter((t) => t.area === fArea);
    if (fEstado !== ALL) list = list.filter((t) => t.estado === fEstado);
    return list;
  }, [store.data.tasks, semana, isCoord, user, fColab, fCliente, fArea, fEstado]);

  if (!store.hydrated) {
    return <div className="min-h-screen" />;
  }

  if (!user) {
    return <IdentityGate onSelect={store.setUser} />;
  }

  const handleSubmit = (values: TaskInput) => {
    if (editing) {
      store.updateTask(editing.id, values);
    } else {
      store.createTask(semana, values);
    }
    setEditing(null);
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

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
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
                  onChange={(iso) => setNewWeek(iso ? toISO(mondayOf(new Date(iso + "T00:00:00"))) : null)}
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

        <section>
          <h2 className="sr-only">Resumen de la semana</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Semana del {weekLabel(semana)}
          </p>
          <StatsBar tasks={weekTasks} />
        </section>

        {isCoord ? (
          <section className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 shadow-panel">
            <Filter className="size-4 text-muted-foreground" />
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
            <FilterSelect
              value={fArea}
              onChange={setFArea}
              placeholder="Área"
              options={[...AREAS]}
            />
            <FilterSelect
              value={fEstado}
              onChange={setFEstado}
              placeholder="Estado"
              options={[...ESTADOS]}
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

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{deleting?.tarea}» de forma permanente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) store.deleteTask(deleting.id);
                setDeleting(null);
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
