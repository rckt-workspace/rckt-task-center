import { cn } from "@/lib/utils";

/** Paleta de avatares alineada a la identidad RCKT (azul marino, morado, verde, ámbar…). */
const PALETTE = [
  "bg-[oklch(0.42_0.11_275)] text-white",
  "bg-[oklch(0.42_0.11_255)] text-white",
  "bg-[oklch(0.45_0.09_195)] text-white",
  "bg-[oklch(0.44_0.09_162)] text-white",
  "bg-[oklch(0.48_0.1_72)] text-white",
  "bg-[oklch(0.46_0.12_25)] text-white",
  "bg-[oklch(0.44_0.1_320)] text-white",
  "bg-[oklch(0.4_0.06_240)] text-white",
] as const;

export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}

interface Props {
  name: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

/** Avatar circular con iniciales y color estable por persona. */
export function PersonAvatar({ name, size = "sm", className }: Props) {
  const sizeClass =
    size === "xs" ? "size-5 text-[9px]" : size === "md" ? "size-9 text-xs" : "size-7 text-[10px]";
  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide select-none",
        sizeClass,
        colorFor(name || "?"),
        className,
      )}
    >
      {initialsOf(name || "?")}
    </span>
  );
}

/** Avatar + nombre, para listas y tarjetas. */
export function PersonChip({
  name,
  size = "sm",
  className,
  nameClassName,
}: Props & { nameClassName?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <PersonAvatar name={name} size={size} />
      <span className={cn("truncate", nameClassName)}>{name || "—"}</span>
    </span>
  );
}
