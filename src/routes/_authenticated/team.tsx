import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Equipo · Centro de Control RCKT" },
      {
        name: "description",
        content: "Directorio y perfiles profesionales del equipo RCKT.",
      },
    ],
  }),
  component: TeamLayout,
});

function TeamLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" size="sm" className="gap-2 mb-4">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Volver al panel
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <Users className="size-8 text-gray-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Equipo</h1>
              <p className="text-gray-600 mt-1">Directorio y perfiles profesionales del equipo RCKT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content outlet */}
      <Outlet />
    </div>
  );
}
