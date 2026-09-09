import { useEffect, useState } from "react";
import { Bell, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Task } from "@/lib/rckt/types";

interface Props {
  userId: string;
  isAdmin: boolean;
  /** Tareas visibles para el usuario (ya filtradas por RLS) */
  tasks: Task[];
  hydrated: boolean;
  /** Abre el detalle de una tarea */
  onOpenTask: (task: Task) => void;
  /** Lleva a la lista general de tareas */
  onGoToList: () => void;
}

type Notice =
  | { kind: "tasks"; tasks: Task[] }
  | { kind: "comments"; authors: string[]; task: Task | null };

const EPOCH = "1970-01-01T00:00:00Z";
export const noticeSessionKey = (userId: string) => `rckt-notice-checked-${userId}`;

/** Aviso emergente al iniciar sesión: tareas nuevas (colaborador) o comentarios nuevos (admin). */
export function LoginNotices({ userId, isAdmin, tasks, hydrated, onOpenTask, onGoToList }: Props) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hydrated || !userId) return;
    if (typeof window === "undefined") return;
    const key = noticeSessionKey(userId);
    if (window.sessionStorage.getItem(key)) return;

    let alive = true;
    (async () => {
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("tasks_seen_at, comments_seen_at")
        .eq("id", userId)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        console.warn("No se pudo comprobar avisos de inicio de sesión:", error.message);
        return;
      }
      // Solo marcamos como revisado cuando la comprobación se completó con datos reales.
      window.sessionStorage.setItem(key, "1");


      if (!isAdmin) {
        const sinceTasks = prof?.tasks_seen_at ?? EPOCH;
        const nuevas = tasks
          .filter((t) => t.assignedTo === userId && t.createdAt > sinceTasks)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (nuevas.length > 0) {
          setNotice({ kind: "tasks", tasks: nuevas });
          setOpen(true);
          return;
        }
      }

      // Comentarios nuevos de cualquier otro autor (admin o colaborador),
      // sobre tareas visibles para este usuario según RLS.
      const since = prof?.comments_seen_at ?? EPOCH;
      const { data: comments } = await supabase
        .from("task_comments")
        .select("task_id, author_id, author_name, created_at")
        .gt("created_at", since)
        .neq("author_id", userId)
        .order("created_at", { ascending: false });
      if (!alive || !comments || comments.length === 0) return;
      const authors = [...new Set(comments.map((c) => c.author_name || "un colaborador"))];
      const latest = comments[0];
      const task = latest ? (tasks.find((t) => t.id === latest.task_id) ?? null) : null;
      setNotice({ kind: "comments", authors, task });
      setOpen(true);
    })();
    return () => {
      alive = false;
    };
  }, [hydrated, userId, isAdmin, tasks]);

  const markSeen = async () => {
    const now = new Date().toISOString();
    const patch =
      notice?.kind === "tasks" ? { tasks_seen_at: now } : { comments_seen_at: now };
    await supabase.from("profiles").update(patch).eq("id", userId);
  };

  const review = async () => {
    setOpen(false);
    void markSeen();
    if (!notice) return;
    if (notice.kind === "tasks") {
      const only = notice.tasks.length === 1 ? notice.tasks[0] : null;
      if (only) onOpenTask(only);
      else onGoToList();
    } else if (notice.task) {
      onOpenTask(notice.task);
    } else {
      onGoToList();
    }
  };

  if (!notice) return null;

  const title =
    notice.kind === "tasks"
      ? notice.tasks.length === 1
        ? "Tienes 1 tarea nueva"
        : `Tienes ${notice.tasks.length} tareas nuevas`
      : notice.authors.length === 1
        ? `Tienes un nuevo mensaje de ${notice.authors[0]}`
        : "Tienes nuevos mensajes de varios colaboradores";

  const description =
    notice.kind === "tasks"
      ? notice.tasks.length === 1
        ? `«${notice.tasks[0]?.tarea}» — ${notice.tasks[0]?.cliente}`
        : "Se te asignaron nuevas tareas desde tu última revisión."
      : notice.task
        ? `En la tarea «${notice.task.tarea}»${notice.authors.length > 1 ? ` y otras (${notice.authors.join(", ")})` : ""}.`
        : "Hay comentarios nuevos en tus tareas.";

  const Icon = notice.kind === "tasks" ? Bell : MessageSquare;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-1 inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Más tarde
          </Button>
          <Button onClick={() => void review()}>Revisar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
