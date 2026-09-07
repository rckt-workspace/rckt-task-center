import {
  Bot,
  Briefcase,
  Building2,
  Code2,
  Megaphone,
  Palette,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AREA_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /(ai|data|ia|dato)/i, icon: Bot },
  { match: /(shopify|frontend|develop|desarroll)/i, icon: Code2 },
  { match: /(creative|creativ|diseñ|design)/i, icon: Palette },
  { match: /(performance|campañ|campan|ads)/i, icon: Megaphone },
  { match: /(project|manager|pm)/i, icon: Briefcase },
];

function areaIcon(area: string): LucideIcon {
  return AREA_ICONS.find((a) => a.match.test(area))?.icon ?? Target;
}

/** Nombre de cliente con ícono para reconocimiento visual rápido. */
export function ClienteTag({ cliente, className }: { cliente: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <Building2 className="size-3.5 shrink-0 text-primary/70" aria-hidden />
      <span className="truncate">{cliente || "—"}</span>
    </span>
  );
}

/** Nombre de área con ícono según la especialidad. */
export function AreaTag({ area, className }: { area: string; className?: string }) {
  const Icon = areaIcon(area);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <Icon className="size-3.5 shrink-0 text-brand-blue/70" aria-hidden />
      <span className="truncate">{area || "—"}</span>
    </span>
  );
}
