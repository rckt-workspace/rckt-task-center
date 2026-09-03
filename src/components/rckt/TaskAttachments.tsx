import { useState } from "react";
import { ExternalLink, FileText, Film, Image as ImageIcon, Link2, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { getAttachmentUrl } from "@/lib/rckt/useAppStore";
import type { Attachment } from "@/lib/rckt/types";
import { cn } from "@/lib/utils";

interface Props {
  adjuntos: Attachment[];
  enlaces: string[];
  className?: string | undefined;
}

export function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
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

/** Lista compacta de enlaces y archivos adjuntos de una tarea (clickeables/descargables). */
export function TaskAttachments({ adjuntos, enlaces, className }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  if (adjuntos.length === 0 && enlaces.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

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
    <ul className={cn("space-y-1 text-sm", className)}>
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
      {adjuntos.map((a) => {
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
