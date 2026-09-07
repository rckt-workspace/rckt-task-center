import { useMemo } from "react";
import type { Perfil, Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import { PersonChip } from "./PersonAvatar";

interface Props {
  profiles: Perfil[];
  tasks: Task[];
  currentUserId?: string | undefined;
  selected?: string | null | undefined;
  onSelect?: ((value: string | null) => void) | undefined;
}

export function WorkloadWidget({
  profiles,
  tasks,
  currentUserId,
  selected,
  onSelect,
}: Props) {
  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of profiles) {
      if (p.id === currentUserId) continue;
      counts.set(p.nombre, 0);
    }
    for (const t of tasks) {
      if (t.estado === "Completada") continue;
      counts.set(t.colaborador, (counts.get(t.colaborador) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) =>
      b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]),
    );
  }, [profiles, tasks, currentUserId]);

  const totalActivas = useMemo(
    () => rows.reduce((sum, [, n]) => sum + n, 0),
    [rows],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-panel">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Carga de trabajo actual</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {totalActivas} activa{totalActivas === 1 ? "" : "s"} en total
        </span>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No hay colaboradores registrados.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(([nombre, activas]) => {
            const isSelected = selected === nombre;
            return (
              <li key={nombre}>
                <button
                  type="button"
                  onClick={() =>
                    onSelect?.(isSelected ? null : nombre)
                  }
                  disabled={!onSelect}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-3 text-left transition-colors",
                    onSelect && "hover:bg-accent/40",
                    isSelected && "bg-accent/50",
                  )}
                >
                  <PersonChip
                    name={nombre}
                    nameClassName="font-medium text-foreground"
                  />
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      activas === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {activas} tarea{activas === 1 ? "" : "s"} activa
                    {activas === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
