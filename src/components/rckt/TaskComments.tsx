import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CommentRow {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

interface ReactionRow {
  id: string;
  comment_id: string;
  user_id: string;
  user_name: string;
  emoji: string;
}

const EMOJIS = ["👍", "✅", "🎉"] as const;

interface Props {
  taskId: string;
  /** Nombre visible del usuario actual (se guarda junto al comentario) */
  authorName: string;
  isAdmin: boolean;
}

function formatWhen(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy, h:mm a");
}

export function TaskComments({ taskId, authorName, isAdmin }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [reactions, setReactions] = useState<ReactionRow[]>([]);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setComments((data ?? []) as CommentRow[]);
    const ids = (data ?? []).map((c) => c.id);
    if (ids.length > 0) {
      const { data: reacts } = await supabase
        .from("comment_reactions")
        .select("*")
        .in("comment_id", ids);
      setReactions((reacts ?? []) as ReactionRow[]);
    } else {
      setReactions([]);
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    void load();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [load]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !userId) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.from("task_comments").insert({
      task_id: taskId,
      author_id: userId,
      author_name: authorName,
      body,
    });
    setSending(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDraft("");
    await load();
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from("task_comments").delete().eq("id", id);
    if (err) setError(err.message);
    else {
      setComments((prev) => prev.filter((c) => c.id !== id));
      setReactions((prev) => prev.filter((r) => r.comment_id !== id));
    }
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!userId) return;
    const existing = reactions.find(
      (r) => r.comment_id === commentId && r.user_id === userId && r.emoji === emoji,
    );
    if (existing) {
      setReactions((prev) => prev.filter((r) => r.id !== existing.id));
      const { error: err } = await supabase
        .from("comment_reactions")
        .delete()
        .eq("id", existing.id);
      if (err) {
        setError(err.message);
        void load();
      }
      return;
    }
    const { data, error: err } = await supabase
      .from("comment_reactions")
      .insert({ comment_id: commentId, user_id: userId, user_name: authorName, emoji })
      .select("*")
      .single();
    if (err) setError(err.message);
    else if (data) setReactions((prev) => [...prev, data as ReactionRow]);
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label className="inline-flex items-center gap-1.5">
        <MessageSquare className="size-3.5" />
        Comentarios
        {comments.length > 0 ? (
          <span className="text-xs font-normal text-muted-foreground">({comments.length})</span>
        ) : null}
      </Label>

      <ul
        ref={listRef}
        className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border bg-background p-3"
      >
        {loading ? (
          <li className="text-xs text-muted-foreground">Cargando comentarios…</li>
        ) : comments.length === 0 ? (
          <li className="text-xs text-muted-foreground">Aún no hay comentarios. Escribe el primero.</li>
        ) : (
          comments.map((c) => {
            const mine = c.author_id === userId;
            return (
              <li
                key={c.id}
                className={cn(
                  "group rounded-md border border-border px-3 py-2 text-sm",
                  mine ? "bg-secondary/60" : "bg-card",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.author_name || "—"}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {formatWhen(c.created_at)}
                    {mine || isAdmin ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Eliminar comentario"
                        onClick={() => void remove(c.id)}
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{c.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {EMOJIS.map((emoji) => {
                    const who = reactions.filter(
                      (r) => r.comment_id === c.id && r.emoji === emoji,
                    );
                    const active = who.some((r) => r.user_id === userId);
                    if (who.length === 0 && !userId) return null;
                    return (
                      <button
                        key={emoji}
                        type="button"
                        title={
                          who.length > 0
                            ? who.map((r) => r.user_name || "—").join(", ")
                            : `Reaccionar con ${emoji}`
                        }
                        aria-pressed={active}
                        aria-label={`Reaccionar con ${emoji}`}
                        onClick={() => void toggleReaction(c.id, emoji)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-secondary",
                          who.length === 0 && "opacity-60 group-hover:opacity-100",
                        )}
                      >
                        <span aria-hidden>{emoji}</span>
                        {who.length > 0 ? <span>{who.length}</span> : null}
                      </button>
                    );
                  })}
                  {reactions.some((r) => r.comment_id === c.id) ? (
                    <span className="ml-1 truncate text-[11px] text-muted-foreground">
                      {reactions
                        .filter((r) => r.comment_id === c.id)
                        .map((r) => `${r.emoji} ${r.user_name || "—"}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <div className="flex items-end gap-2">
        <Textarea
          value={draft}
          rows={2}
          maxLength={1000}
          placeholder="Escribe una duda, aclaración o avance…"
          className="min-h-[40px] resize-none"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-1.5"
          disabled={sending || !draft.trim() || !userId}
          onClick={() => void send()}
        >
          <Send className="size-3.5" />
          Enviar
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
