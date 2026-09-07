import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

/** Estado vacío con ícono e ilustración simple en colores de marca. */
export function EmptyState({ icon: Icon, title, description, className, compact }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card text-center",
        compact ? "gap-1.5 px-4 py-6" : "gap-2 px-6 py-12",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-accent/70 text-primary",
          compact ? "size-8" : "size-12",
        )}
      >
        <Icon className={compact ? "size-4" : "size-6"} aria-hidden />
      </span>
      <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>{title}</p>
      {description ? (
        <p className={cn("max-w-sm text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
