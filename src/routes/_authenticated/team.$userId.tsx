import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PersonAvatar } from "@/components/rckt/PersonAvatar";
import { EstadoBadge } from "@/components/rckt/EstadoBadge";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarUrl } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/team/$userId")({
  component: TeamProfilePage,
});

interface TeamProfile {
  id: string;
  fullName: string;
  email: string;
  cargo: string;
  bio: string;
  avatarPath: string | null;
  role: "admin" | "colaborador";
}

interface TeamContext {
  roleTitle: string;
  roleSummary: string;
  specialties: string[];
  responsibilities: string[];
  strengths: string[];
  typicalWork: string;
  capacityHoursPerWeek: number;
}

interface TaskProgress {
  task_id: string;
  cliente: string;
  tarea: string;
  estado: string;
  fecha_limite: string;
  steps_total: number;
  steps_done: number;
}

function TeamProfilePage() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const getAvatarUrlFn = useServerFn(getAvatarUrl);
  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [teamContext, setTeamContext] = useState<TeamContext | null>(null);
  const [currentTasks, setCurrentTasks] = useState<TaskProgress[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load team directory using secure RPC
        const { data: directoryData, error: dirError } = await supabase.rpc(
          "get_team_directory"
        );

        if (dirError) {
          throw new Error(`Error al cargar directorio: ${dirError.message}`);
        }

        if (!directoryData) {
          throw new Error("Integrante no encontrado");
        }

        // Find the user in the directory
        const userProfile = (directoryData as any[]).find((u) => u.user_id === userId);

        if (!userProfile) {
          throw new Error("Integrante no encontrado");
        }

        setProfile({
          id: userProfile.user_id,
          fullName: userProfile.full_name || "",
          email: userProfile.email || "",
          cargo: userProfile.cargo || "",
          bio: userProfile.bio || "",
          avatarPath: userProfile.avatar_path,
          role: userProfile.role || "colaborador",
        });

        // Extract team context from directory response
        if (
          userProfile.role_title ||
          userProfile.specialties ||
          userProfile.responsibilities
        ) {
          setTeamContext({
            roleTitle: userProfile.role_title || "",
            roleSummary: userProfile.role_summary || "",
            specialties: userProfile.specialties || [],
            responsibilities: userProfile.responsibilities || [],
            strengths: userProfile.strengths || [],
            typicalWork: userProfile.typical_work || "",
            capacityHoursPerWeek: 0, // Not in RPC response
          });
        }

        // Load avatar URL
        if (userProfile.avatar_path) {
          const result = await getAvatarUrlFn({ data: { userId } });
          if (result.url) {
            setAvatarUrl(result.url);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el perfil");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId, getAvatarUrlFn]);

  // Load current tasks for this user
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const { data, error: tasksError } = await supabase.rpc("get_team_task_progress");
        if (tasksError) throw tasksError;

        if (data) {
          // Filter tasks where this user is primary or in assignees
          const userTasks = (data as any[]).filter(
            (task) =>
              task.primary_user_id === userId ||
              (task.assignee_ids && task.assignee_ids.includes(userId))
          );
          setCurrentTasks(userTasks as TaskProgress[]);
        }
      } catch (err) {
        console.error("Error loading tasks:", err);
      }
    };

    if (profile) {
      loadTasks();
    }
  }, [profile, userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">{error || "Perfil no encontrado"}</h1>
          <Button asChild className="mt-4">
            <Link to="/team">Volver al equipo</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="gap-2 mb-4">
          <Link to="/team">
            <ArrowLeft className="size-4" />
            Volver al equipo
          </Link>
        </Button>

        {/* Profile Header */}
        <Card className="mb-6 p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <PersonAvatar name={profile.fullName} imageUrl={avatarUrl} size="md" className="size-24" />

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-gray-900">{profile.fullName}</h2>
              <p className="text-gray-600">{profile.cargo || "Sin cargo asignado"}</p>
              <p className="text-sm text-gray-500">{profile.email}</p>
              {profile.role && (
                <p className="text-sm font-medium text-blue-600 capitalize mt-1">
                  {profile.role === "admin" ? "Administrador" : "Colaborador"}
                </p>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-6">
          {/* Bio Section */}
          {profile.bio && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Acerca de</h3>
              <p className="text-gray-700">{profile.bio}</p>
            </Card>
          )}

          {/* Professional Context Section */}
          {teamContext && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contexto Profesional</h3>
              <div className="space-y-4">
                {teamContext.roleTitle && (
                  <div>
                    <h4 className="font-medium text-gray-900">{teamContext.roleTitle}</h4>
                    <p className="text-sm text-gray-600 mt-1">{teamContext.roleSummary}</p>
                  </div>
                )}

                {teamContext.specialties.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Especialidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {teamContext.specialties.map((spec) => (
                        <span
                          key={spec}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {teamContext.responsibilities.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Responsabilidades</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {teamContext.responsibilities.map((resp) => (
                        <li key={resp}>{resp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {teamContext.strengths.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Fortalezas</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {teamContext.strengths.map((strength) => (
                        <li key={strength}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {teamContext.typicalWork && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Trabajo Típico</h4>
                    <p className="text-sm text-gray-700">{teamContext.typicalWork}</p>
                  </div>
                )}

                {teamContext.capacityHoursPerWeek > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Capacidad Semanal</h4>
                    <p className="text-sm text-gray-700">{teamContext.capacityHoursPerWeek} horas/semana</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Current Tasks Section */}
          {currentTasks.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tareas actuales</h3>
              <div className="space-y-3">
                {currentTasks
                  .filter((task) => task.estado !== "Completada")
                  .map((task) => {
                    const progressPercent =
                      task.steps_total > 0
                        ? Math.round((task.steps_done / task.steps_total) * 100)
                        : 0;

                    return (
                      <div key={task.task_id} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">{task.tarea}</h4>
                            <p className="text-xs text-gray-500 mt-1">{task.cliente}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <EstadoBadge estado={task.estado as any} />
                              {task.fecha_limite && (
                                <span className="text-xs text-gray-600">
                                  Vence: {new Date(task.fecha_limite).toLocaleDateString("es-ES")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Progress bar if steps exist */}
                        {task.steps_total > 0 && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-600">
                                {task.steps_done}/{task.steps_total}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </Card>
          )}

          {/* Empty state for tasks */}
          {currentTasks.filter((t) => t.estado !== "Completada").length === 0 &&
            currentTasks.length > 0 && (
              <Card className="p-6 text-center">
                <CheckCircle2 className="size-8 text-green-600 mx-auto mb-2" />
                <p className="text-gray-600 font-medium">Todas las tareas completadas</p>
              </Card>
            )}
        </div>
      </div>
    </div>
  );
}
