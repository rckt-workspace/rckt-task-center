import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PersonAvatar, PersonChip } from "@/components/rckt/PersonAvatar";
import { EstadoBadge } from "@/components/rckt/EstadoBadge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Proyectos · Centro de Control RCKT" },
      { name: "description", content: "Vista de proyectos y clientes del Centro de Control RCKT." },
    ],
  }),
  component: ProjectsPage,
});

interface TaskProgressData {
  task_id: string;
  cliente: string;
  tarea: string;
  estado: string;
  fecha_limite: string;
  primary_user_id: string;
  primary_name: string;
  assignee_ids: string[] | null;
  assignee_names: string[] | null;
  steps_total: number;
  steps_done: number;
}

interface ProjectSummary {
  cliente: string;
  total: number;
  completadas: number;
  enCurso: number;
  pendientes: number;
  miembros: Set<string>;
  tareas: TaskProgressData[];
}

function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: rpcError } = await supabase.rpc("get_team_task_progress");

        if (rpcError) {
          throw new Error(
            `La función get_team_task_progress no existe aún. Necesita aplicar la migración. Error: ${rpcError.message}`,
          );
        }

        if (!data) {
          setProjects([]);
          return;
        }

        // Build projects from RPC data
        const projectMap = new Map<string, ProjectSummary>();

        for (const task of data as TaskProgressData[]) {
          const key = task.cliente || "Sin cliente";
          if (!projectMap.has(key)) {
            projectMap.set(key, {
              cliente: key,
              total: 0,
              completadas: 0,
              enCurso: 0,
              pendientes: 0,
              miembros: new Set(),
              tareas: [],
            });
          }

          const project = projectMap.get(key)!;
          project.total++;
          project.tareas.push(task);

          // Add primary user
          if (task.primary_name) {
            project.miembros.add(task.primary_name);
          }

          // Add secondary assignees
          if (task.assignee_names && Array.isArray(task.assignee_names)) {
            for (const name of task.assignee_names) {
              if (name) project.miembros.add(name);
            }
          }

          if (task.estado === "Completada") project.completadas++;
          else if (task.estado === "En curso") project.enCurso++;
          else if (task.estado === "Pendiente") project.pendientes++;
        }

        const sorted = [...projectMap.values()].sort((a, b) =>
          a.cliente.localeCompare(b.cliente, "es"),
        );
        setProjects(sorted);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar proyectos");
        console.error("Error loading projects:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="border-b bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <Button asChild variant="ghost" size="sm" className="gap-2 mb-4">
              <Link to="/dashboard">
                <ArrowLeft className="size-4" />
                Volver al panel
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Proyectos</h1>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <Card className="p-8 text-center border-red-200 bg-red-50">
            <p className="text-red-900 font-medium">{error}</p>
            <p className="text-sm text-red-700 mt-2">
              Por favor, aplica la migración <code>20260927120000_team_projects_multi_assignee.sql</code> en Supabase.
            </p>
          </Card>
        </div>
      </div>
    );
  }

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
            <Briefcase className="size-8 text-gray-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Proyectos</h1>
              <p className="text-gray-600 mt-1">Vista general de clientes y avance de tareas</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {projects.length === 0 ? (
          <Card className="p-8 text-center">
            <Briefcase className="size-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No hay tareas o proyectos disponibles</p>
            <p className="text-sm text-gray-400 mt-2">Las tareas aparecerán aquí una vez se asignen.</p>
          </Card>
        ) : (
          <div className="grid gap-6">
            {projects.map((project) => {
              const progressPercent =
                project.total > 0 ? Math.round((project.completadas / project.total) * 100) : 0;

              return (
                <Card key={project.cliente} className="p-6 hover:shadow-lg transition-shadow">
                  {/* Project Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{project.cliente}</h2>

                    {/* Progress Section */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Progreso general</span>
                        <span className="text-sm font-bold text-gray-900">{progressPercent}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <p className="text-2xl font-bold text-green-600">{project.completadas}</p>
                        <p className="text-xs text-gray-600">Completadas</p>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <p className="text-2xl font-bold text-blue-600">{project.enCurso}</p>
                        <p className="text-xs text-gray-600">En curso</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded">
                        <p className="text-2xl font-bold text-amber-600">{project.pendientes}</p>
                        <p className="text-xs text-gray-600">Pendientes</p>
                      </div>
                      <div className="text-center p-2 bg-gray-100 rounded">
                        <p className="text-2xl font-bold text-gray-700">{project.total}</p>
                        <p className="text-xs text-gray-600">Total</p>
                      </div>
                    </div>
                  </div>

                  {/* Team Members */}
                  {project.miembros.size > 0 && (
                    <div className="mb-6 pb-6 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Equipo</p>
                      <div className="flex flex-wrap gap-2">
                        {[...project.miembros].map((miembro) => (
                          <button
                            key={miembro}
                            onClick={() => {
                              // Find the user_id for this member
                              const userTask = project.tareas.find(
                                (t) => t.primary_name === miembro || t.assignee_names?.includes(miembro),
                              );
                              if (userTask) {
                                const userId = userTask.primary_name === miembro
                                  ? userTask.primary_user_id
                                  : userTask.assignee_ids?.[userTask.assignee_names?.indexOf(miembro) ?? -1];
                                if (userId) {
                                  window.location.href = `/team/${userId}`;
                                }
                              }
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-gray-100 transition text-sm"
                          >
                            <PersonAvatar name={miembro} size="xs" />
                            <span className="text-gray-700">{miembro}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks Summary */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">{project.total} tareas</p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {project.tareas.map((tarea) => {
                        const progressPercent =
                          tarea.steps_total > 0
                            ? Math.round((tarea.steps_done / tarea.steps_total) * 100)
                            : 0;

                        return (
                          <div
                            key={tarea.task_id}
                            className="p-3 hover:bg-gray-50 rounded text-sm border border-gray-100"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{tarea.tarea}</p>
                                <p className="text-xs text-gray-500 mt-1">{tarea.primary_name}</p>
                              </div>
                              <EstadoBadge estado={tarea.estado as any} />
                            </div>
                            {tarea.steps_total > 0 && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Progress value={progressPercent} className="h-1.5" />
                                  <span className="text-xs text-gray-600 font-medium">
                                    {tarea.steps_done}/{tarea.steps_total}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
