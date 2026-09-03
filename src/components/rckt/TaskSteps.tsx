import { useCallback, useEffect, useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface StepRow {
  id: string;
  task_id: string;
  owner_id: string;
  title: string;
  done: boolean;
  position: number;
}

interface Props {
  taskId: string;
  /** La admin solo puede ver; el colaborador asignado gestiona */
  readOnly: boolean;
}

export function TaskSteps({ taskId, readOnly }: Props) {
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("task_steps")
      .select("id, task_id, owner_id, title, done, position")
      .eq("task_id", taskId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setSteps((data ?? []) as StepRow[]);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    void load();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [load]);

  const add = async () => {
    const title = draft.trim();
    if (!title || !userId) return;
    setSaving(true);
    setError(null);
    const position = steps.length ? Math.max(...steps.map((s) => s.position)) + 1 : 0;
    const { error: err } = await supabase
      .from("task_steps")
      .insert({ task_id: taskId, owner_id: userId, title, position });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDraft("");
    await load();
  };

  const toggle = async (step: StepRow) => {
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s)));
    const { error: err } = await supabase
      .from("task_steps")
      .update({ done: !step.done })
      .eq("id", step.id);
    if (err) {
      setError(err.message);
      await load();
    }
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from("task_steps").delete().eq("id", id);
    if (err) setError(err.message);
    else setSteps((prev) => prev.filter((s) => s.id !== id));
  };

  const doneCount = steps.filter((s) => s.done).length;

  // Para la admin, ocultar la sección si el colaborador aún no creó pasos.
  if (readOnly && !loading && steps.length === 0) return null;

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label className="inline-flex items-center gap-1.5">
        <ListChecks className="size-3.5" />
        {readOnly ? "Pasos del colaborador" : "Mis pasos"}
        {steps.length > 0 ? (
          <span className="text-xs font-normal text-muted-foreground">
            ({doneCount}/{steps.length})
          </span>
        ) : null}
      </Label>
      {!readOnly ? (
        <p className="text-xs text-muted-foreground">
          Checklist personal para organizar tu trabajo. No afecta el estado general de la tarea.
        </p>
      ) : null}

      {steps.length > 0 ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.round((doneCount / steps.length) * 100)}%` }}
          />
        </div>
      ) : null}

      <ul className="space-y-1 rounded-md border border-border bg-background p-2">
        {loading ? (
          <li className="px-1 text-xs text-muted-foreground">Cargando pasos…</li>
        ) : steps.length === 0 ? (
          <li className="px-1 text-xs text-muted-foreground">Aún no tienes pasos. Agrega el primero abajo.</li>
        ) : (
          steps.map((s) => (
            <li key={s.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-secondary/40">
              <Checkbox
                id={`step-${s.id}`}
                checked={s.done}
                disabled={readOnly}
                onCheckedChange={() => void toggle(s)}
              />
              <label
                htmlFor={`step-${s.id}`}
                className={cn(
                  "flex-1 cursor-pointer text-sm break-words",
                  s.done && "text-muted-foreground line-through",
                  readOnly && "cursor-default",
                )}
              >
                {s.title}
              </label>
              {!readOnly ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Eliminar paso"
                  onClick={() => void remove(s.id)}
                >
                  <Trash2 className="size-3 text-destructive" />
                </Button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {!readOnly ? (
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            maxLength={200}
            placeholder="Ej. Diseñar mockup, Revisar con cliente…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5"
            disabled={saving || !draft.trim() || !userId}
            onClick={() => void add()}
          >
            <Plus className="size-3.5" />
            Agregar paso
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
