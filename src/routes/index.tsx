import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Centro de Control Semanal RCKT" },
      {
        name: "description",
        content:
          "Panel interno RCKT para planear, asignar y hacer seguimiento semanal de tareas por colaborador, cliente y área.",
      },
      { property: "og:title", content: "Centro de Control Semanal RCKT" },
      {
        property: "og:description",
        content: "Seguimiento semanal de tareas por colaborador, cliente y área.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      void navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-accent-foreground uppercase">
          RCKT
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Centro de Control Semanal</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cargando tu espacio de trabajo…</p>
      </div>
    </main>
  );
}
