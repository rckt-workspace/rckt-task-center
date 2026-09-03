import { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mic,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { getAttachmentUrl } from "@/lib/rckt/useAppStore";
import type { Attachment } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Props {
  adjuntos: Attachment[];
  enlaces: string[];
  className?: string | undefined;
}

export function isAudio(mime: string, name = ""): boolean {
  return mime.startsWith("audio/") || /\.(webm|m4a|mp3|ogg|wav|aac)$/i.test(name);
}

export function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return Mic;
  return FileText;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return u.pathname.length > 1 ? `${host}${u.pathname.slice(0, 24)}${u.pathname.length > 24 ? "…" : ""}` : host;
  } catch {
    return url;
  }
}

/** Reproductor de una nota de voz adjunta (URL firmada temporal). */
export function AudioPlayer({ a }: { a: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    getAttachmentUrl(a.path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [a.path]);

  return (
    <div className="rounded-md border border-border bg-background p-2">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Mic className="size-3.5 shrink-0 text-primary" />
        <span className="truncate">Nota de voz</span>
        <span className="text-muted-foreground">· {formatSize(a.size)}</span>
      </div>
      {failed ? (
        <p className="text-xs text-destructive">No se pudo cargar el audio.</p>
      ) : url ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls preload="metadata" src={url} className="h-8 w-full min-w-48 max-w-xs" />
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Cargando…
        </div>
      )}
    </div>
  );
}

/** Lista compacta de enlaces y archivos adjuntos de una tarea (clickeables/descargables). */
export function TaskAttachments({ adjuntos, enlaces, className }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  if (adjuntos.length === 0 && enlaces.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const audios = adjuntos.filter((a) => isAudio(a.mime, a.name));
  const files = adjuntos.filter((a) => !isAudio(a.mime, a.name));

  const open = async (a: Attachment) => {
    setLoading(a.id);
    try {
      const url = await getAttachmentUrl(a.path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el archivo");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {audios.map((a) => (
        <AudioPlayer key={a.id} a={a} />
      ))}
      {enlaces.length > 0 || files.length > 0 ? (
        <ul className="space-y-1">
          {enlaces.map((url, i) => (
            <li key={`l-${i}`}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"
                title={url}
              >
                <Link2 className="size-3.5 shrink-0" />
                <span className="truncate">{linkLabel(url)}</span>
                <ExternalLink className="size-3 shrink-0 opacity-60" />
              </a>
            </li>
          ))}
          {files.map((a) => {
            const Icon = fileIcon(a.mime);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => void open(a)}
                  className="inline-flex max-w-full items-center gap-1.5 text-left text-primary hover:underline"
                  title={`${a.name} · ${formatSize(a.size)}`}
                >
                  {loading === a.id ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Icon className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{a.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function AttachmentsCount({ adjuntos, enlaces }: { adjuntos: Attachment[]; enlaces: string[] }) {
  const n = adjuntos.length + enlaces.length;
  if (n === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Paperclip className="size-3" />
      {n}
    </span>
  );
}
