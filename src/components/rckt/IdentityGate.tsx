import { Button } from "@/components/ui/button";
import { COLABORADORES, COORDINADORA, type Identidad } from "@/lib/rckt/types";
import { ShieldCheck, User } from "lucide-react";

export function IdentityGate({ onSelect }: { onSelect: (id: Identidad) => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-accent-foreground uppercase">
          RCKT
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Centro de Control Semanal</h1>
        <p className="mt-2 text-sm text-muted-foreground">¿Quién eres?</p>

        <div className="mt-6 space-y-2">
          <button
            onClick={() => onSelect(COORDINADORA)}
            className="flex w-full items-center gap-3 rounded-lg border border-primary/25 bg-card px-4 py-3.5 text-left shadow-panel transition-colors hover:bg-accent/40"
          >
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-medium">Coordinadora</span>
            <span className="ml-auto text-xs text-muted-foreground">Acceso completo</span>
          </button>

          {COLABORADORES.map((c) => (
            <button
              key={c}
              onClick={() => onSelect(c)}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left shadow-panel transition-colors hover:bg-accent/40"
            >
              <User className="size-4 text-muted-foreground" />
              <span className="font-medium">{c}</span>
              <span className="ml-auto text-xs text-muted-foreground">Colaborador</span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Tu selección se guarda en este navegador y puedes cambiarla cuando quieras.
        </p>
        <Button variant="link" className="hidden" />
      </div>
    </main>
  );
}
