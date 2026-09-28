import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PersonAvatar } from "@/components/rckt/PersonAvatar";
import { supabase } from "@/integrations/supabase/client";
import { getAvatarUrl } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/team/")({
  head: () => ({
    meta: [
      { title: "Equipo · Centro de Control RCKT" },
      {
        name: "description",
        content: "Directorio profesional del equipo RCKT.",
      },
    ],
  }),
  component: TeamDirectoryPage,
});

interface TeamMember {
  user_id: string;
  full_name: string;
  cargo: string;
  avatar_path: string | null;
  bio: string;
  role: string;
  role_title: string;
  role_summary: string;
  specialties: string[];
}

function TeamDirectoryPage() {
  const getAvatarUrlFn = useServerFn(getAvatarUrl);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeamDirectory = async () => {
      try {
        setLoading(true);
        setError(null);

        // Call the RPC function
        const { data, error: rpcError } = await (supabase.rpc as any)("get_team_directory");

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        if (!data) {
          setMembers([]);
          return;
        }

        setMembers(data as TeamMember[]);

        // Load avatar URLs for all members
        const urls: Record<string, string> = {};
        for (const member of data as TeamMember[]) {
          if (member.avatar_path) {
            try {
              const result = await getAvatarUrlFn({ data: { userId: member.user_id } });
              if (result.url) {
                urls[member.user_id] = result.url;
              }
            } catch {
              // Silently ignore avatar loading errors
            }
          }
        }
        setAvatarUrls(urls);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar el directorio");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTeamDirectory();
  }, [getAvatarUrlFn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">{error}</h1>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Volver al panel</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {members.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No hay miembros del equipo disponibles</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => (
            <Card key={member.user_id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="text-center mb-4">
                <div className="flex justify-center mb-4">
                  <PersonAvatar
                    name={member.full_name}
                    imageUrl={avatarUrls[member.user_id] ?? ""}
                    size="md"
                    className="size-16"
                  />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{member.full_name}</h2>
                <p className="text-sm text-gray-600 mt-1">{member.cargo || "Sin cargo"}</p>
                {member.role && (
                  <p className="text-xs font-medium text-blue-600 capitalize mt-2">
                    {member.role === "admin" ? "Administrador" : "Colaborador"}
                  </p>
                )}
              </div>

              {member.bio && (
                <p className="text-sm text-gray-700 mb-4 line-clamp-2">{member.bio}</p>
              )}

              {member.specialties && member.specialties.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-1 justify-center">
                    {member.specialties.slice(0, 3).map((spec) => (
                      <span
                        key={spec}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <Button asChild className="w-full" variant="outline">
                <Link to={`/team/${member.user_id}` as "/team/$userId"}>Ver perfil</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
