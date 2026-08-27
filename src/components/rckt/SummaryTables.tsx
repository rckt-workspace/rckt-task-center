import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Task } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  completadas: number;
  enCurso: number;
  pendientes: number;
  total: number;
  pct: number;
}

function buildRows(tasks: Task[], field: "cliente" | "colaborador"): Row[] {
  const total = tasks.length;
  const map = new Map<string, Row>();
  for (const t of tasks) {
    const key = t[field];
    const row = map.get(key) ?? { key, completadas: 0, enCurso: 0, pendientes: 0, total: 0, pct: 0 };
    if (t.estado === "Completada") row.completadas += 1;
    else if (t.estado === "En curso") row.enCurso += 1;
    else row.pendientes += 1;
    row.total += 1;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, pct: total === 0 ? 0 : Math.round((r.total / total) * 100) }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

interface Props {
  title: string;
  tasks: Task[];
  field: "cliente" | "colaborador";
  selected: string | null;
  onSelect: (value: string | null) => void;
}

export function SummaryTable({ title, tasks, field, selected, onSelect }: Props) {
  const rows = buildRows(tasks, field);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-panel">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {selected ? (
          <button
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onSelect(null)}
          >
            Quitar filtro
          </button>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Sin datos para esta semana.
        </p>
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                  <TableHead>{field === "cliente" ? "Cliente" : "Colaborador"}</TableHead>
                  <TableHead className="text-right">Compl.</TableHead>
                  <TableHead className="text-right">En curso</TableHead>
                  <TableHead className="text-right">Pend.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.key}
                    onClick={() => onSelect(selected === r.key ? null : r.key)}
                    className={cn(
                      "cursor-pointer",
                      selected === r.key && "bg-accent/50 hover:bg-accent/60",
                    )}
                  >
                    <TableCell className="font-medium">{r.key}</TableCell>
                    <TableCell className="text-right text-success">{r.completadas}</TableCell>
                    <TableCell className="text-right text-info">{r.enCurso}</TableCell>
                    <TableCell className="text-right text-warn">{r.pendientes}</TableCell>
                    <TableCell className="text-right font-medium">{r.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.pct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Móvil */}
          <ul className="divide-y divide-border md:hidden">
            {rows.map((r) => (
              <li key={r.key}>
                <button
                  onClick={() => onSelect(selected === r.key ? null : r.key)}
                  className={cn(
                    "w-full px-4 py-3 text-left",
                    selected === r.key && "bg-accent/50",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{r.key}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.total} · {r.pct}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="text-success">{r.completadas} compl.</span> ·{" "}
                    <span className="text-info">{r.enCurso} en curso</span> ·{" "}
                    <span className="text-warn">{r.pendientes} pend.</span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
