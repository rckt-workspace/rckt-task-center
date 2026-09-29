import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Circle,
  FileUp,
  ListChecks,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  task_id: string | null;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

interface Props {
  userId: string;
  onOpenTask: (taskId: string) => void;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));

  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

function iconFor(type: string) {
  if (type === "comment_added") return MessageSquare;
  if (type === "attachment_added" || type === "voice_note_added") return FileUp;
  if (type.startsWith("step_")) return ListChecks;
  if (type === "task_completed") return Check;
  return Circle;
}

export function TaskNotificationBell({ userId, onOpenTask }: Props) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at).length,
    [notifications],
  );

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("notifications")
      .select("id, recipient_id, actor_id, task_id, type, title, message, metadata, read_at, created_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("No se pudieron cargar las notificaciones:", error.message);
      setLoading(false);
      return;
    }

    setNotifications((data ?? []) as NotificationRow[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel(`task-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as NotificationRow;
          setNotifications((current) => {
            if (current.some((item) => item.id === incoming.id)) return current;
            return [incoming, ...current].slice(0, 50);
          });
          toast(incoming.title, {
            description: incoming.message,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as NotificationRow;
          setNotifications((current) =>
            current.map((item) => (item.id === incoming.id ? incoming : item)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();

    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: now } : item)),
    );

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: now })
      .eq("id", id)
      .eq("recipient_id", userId);

    if (error) {
      console.warn("No se pudo marcar la notificación como leída:", error.message);
      void load();
    }
  }, [load, userId]);

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return;

    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: now })),
    );

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_id", userId)
      .is("read_at", null);

    if (error) {
      console.warn("No se pudieron marcar las notificaciones como leídas:", error.message);
      void load();
    }
  }, [load, unreadCount, userId]);

  const openNotification = async (notification: NotificationRow) => {
    if (!notification.read_at) {
      await markRead(notification.id);
    }

    setOpen(false);

    if (notification.task_id) {
      onOpenTask(notification.task_id);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/15 hover:text-header-foreground"
          aria-label={
            unreadCount > 0
              ? `Notificaciones: ${unreadCount} sin leer`
              : "Notificaciones"
          }
          title="Notificaciones"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[min(92vw,420px)] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-semibold">Notificaciones</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} sin leer`
                : "Estás al día"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => void load()}
              disabled={loading}
              title="Actualizar"
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="size-3.5" />
              Marcar leídas
            </Button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Cargando notificaciones…
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No tienes notificaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aquí aparecerán asignaciones, comentarios y cambios de tareas.
              </p>
            </div>
          ) : (
            <ul>
              {notifications.map((notification) => {
                const Icon = iconFor(notification.type);
                const unread = !notification.read_at;

                return (
                  <li key={notification.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      className={cn(
                        "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60",
                        unread && "bg-primary/5",
                      )}
                      onClick={() => void openNotification(notification)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full",
                          unread
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm",
                              unread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {notification.title}
                          </span>
                          {unread ? (
                            <span
                              className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                              aria-label="Sin leer"
                            />
                          ) : null}
                        </span>

                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">
                          {relativeTime(notification.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
