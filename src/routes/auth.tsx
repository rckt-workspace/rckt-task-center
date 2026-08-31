import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapAdmin, needsBootstrap } from "@/lib/bootstrap.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Ingresar · Centro de Control Semanal RCKT" },
      {
        name: "description",
        content: "Acceso interno al Centro de Control Semanal RCKT con correo y contraseña.",
      },
      { property: "og:title", content: "Ingresar · Centro de Control Semanal RCKT" },
      {
        property: "og:description",
        content: "Acceso interno al Centro de Control Semanal RCKT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrap, setBootstrap] = useState(false);
  const [fullName, setFullName] = useState("");
  const checkBootstrap = useServerFn(needsBootstrap);
  const createFirstAdmin = useServerFn(bootstrapAdmin);

  useEffect(() => {
    checkBootstrap().then((r) => setBootstrap(r.needed)).catch(() => setBootstrap(false));
  }, [checkBootstrap]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (bootstrap) {
      try {
        await createFirstAdmin({ data: { email, password, fullName } });
        setBootstrap(false);
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
        return;
      }
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Correo o contraseña incorrectos.");
      return;
    }
    void navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-accent-foreground uppercase">
          RCKT
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Centro de Control Semanal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresa con tu correo corporativo y contraseña.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5 shadow-panel">
          {bootstrap ? (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              minLength={8}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Procesando…" : bootstrap ? "Crear cuenta de administradora" : "Ingresar"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {bootstrap
              ? "No hay cuentas todavía: esta primera cuenta será la administradora."
              : "Las cuentas las crea la administradora. Si no tienes acceso, solicítalo a coordinación."}
          </p>
        </form>
      </div>
    </main>
  );
}
