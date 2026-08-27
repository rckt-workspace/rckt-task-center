import { cn } from "@/lib/utils";
import type { Estado } from "@/lib/rckt/types";

const styles: Record<Estado, string> = {
  Completada: "bg-success-soft text-success border-success/25",
  "En curso": "bg-info-soft text-info border-info/25",
  Pendiente: "bg-warn-soft text-warn border-warn/25",
};

export function EstadoBadge({ estado, className }: { estado: Estado; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[estado],
        className,
      )}
    >
      {estado}
    </span>
  );
}
