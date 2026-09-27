import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Camera, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/rckt/PersonAvatar";
import { useAppStore } from "@/lib/rckt/useAppStore";
import { supabase } from "@/integrations/supabase/client";
import {
  updateProfile,
  changePassword,
  getAvatarUrl,
  deleteOldAvatar,
} from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

interface TeamMemberContext {
  roleTitle: string;
  roleSummary: string;
  specialties: string[];
  responsibilities: string[];
  strengths: string[];
  typicalWork: string;
  capacityHoursPerWeek: number;
}

function ProfilePage() {
  const navigate = useNavigate();
  const store = useAppStore();
  const updateProfileFn = useServerFn(updateProfile);
  const changePasswordFn = useServerFn(changePassword);
  const getAvatarUrlFn = useServerFn(getAvatarUrl);
  const deleteOldAvatarFn = useServerFn(deleteOldAvatar);

  const [teamContext, setTeamContext] = useState<TeamMemberContext | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Profile edit state
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Password change state
  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordsVisible, setPasswordsVisible] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const perfil = store.perfil;
  const userId = store.session?.user.id;

  // Load initial data
  useEffect(() => {
    if (perfil) {
      setFullName(perfil.nombre);
      setBio(perfil.bio || "");
    }
  }, [perfil]);

  // Load avatar URL
  useEffect(() => {
    if (userId) {
      getAvatarUrlFn({ data: { userId } })
        .then((result) => {
          if (result.url) setAvatarUrl(result.url);
        })
        .catch(() => setAvatarUrl(null));
    }
  }, [userId, getAvatarUrlFn]);

  // Load team context
  useEffect(() => {
    if (!userId) return;
    const loadContext = async () => {
      const { data, error } = await supabase
        .from("team_member_contexts")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.debug("No team context found");
        return;
      }

      if (data) {
        setTeamContext({
          roleTitle: data.role_title || "",
          roleSummary: data.role_summary || "",
          specialties: data.specialties || [],
          responsibilities: data.responsibilities || [],
          strengths: data.strengths || [],
          typicalWork: data.typical_work || "",
          capacityHoursPerWeek: data.capacity_hours_per_week || 0,
        });
      }
    };

    loadContext();
  }, [userId]);

  if (!store.hydrated || !perfil) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Check if must change password
  const mustChangePassword = perfil.mustChangePassword === true;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Solo se permiten imágenes JPG, PNG o WEBP");
      return;
    }

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      toast.error("El archivo no debe superar 5 MB");
      return;
    }

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile || !userId) return;

    const loadingToast = toast.loading("Subiendo avatar...");
    try {
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const path = `${userId}/avatar-${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, avatarFile, { upsert: false });

      if (uploadError) throw uploadError;

      // Update profile with new avatar path
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Delete old avatar if exists
      if (perfil.avatarPath) {
        await deleteOldAvatarFn({ data: { path: perfil.avatarPath } }).catch(() => {
          // Non-critical error
        });
      }

      // Update UI with new signed URL
      const { data: signedData } = await supabase.storage
        .from("profile-avatars")
        .createSignedUrl(path, 60 * 60);

      if (signedData) {
        setAvatarUrl(signedData.signedUrl);
      }

      setAvatarFile(null);
      setAvatarPreview(null);
      toast.dismiss(loadingToast);
      toast.success("Avatar actualizado correctamente");
      await store.refresh();
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : "Error al subir el avatar");
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateProfileFn({
        data: {
          fullName,
          bio,
        },
      });
      toast.success("Perfil actualizado correctamente");
      await store.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Las nuevas contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (!currentPassword) {
      toast.error("Debes ingresar tu contraseña actual");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePasswordFn({
        data: {
          currentPassword,
          newPassword,
          confirmPassword,
        },
      });
      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await store.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar la contraseña");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="size-5" />
            <span>Volver al panel</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Mi Perfil</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Warning if password must be changed */}
        {mustChangePassword && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-semibold text-amber-900">
              ⚠️ Por seguridad debes cambiar la contraseña temporal antes de continuar.
            </p>
          </div>
        )}

        {/* Avatar Section */}
        <Card className="mb-6 p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative">
              <PersonAvatar name={fullName} imageUrl={avatarPreview || avatarUrl} size="md" className="size-24" />
              <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 transition">
                <Camera className="size-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                  disabled={isSaving}
                />
              </label>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
              <p className="text-gray-600">{perfil.cargo || "Sin cargo asignado"}</p>
              <p className="text-sm text-gray-500">{perfil.email}</p>
              {perfil.role && (
                <p className="text-sm font-medium text-blue-600 capitalize mt-1">
                  {perfil.role === "admin" ? "Administrador" : "Colaborador"}
                </p>
              )}
            </div>

            {avatarFile && (
              <Button
                onClick={handleUploadAvatar}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Subir avatar
              </Button>
            )}
          </div>
        </Card>

        <div className="grid gap-6">
          {/* Personal Information Section */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información personal</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="full-name">Nombre completo</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={perfil.email}
                  disabled
                  className="mt-1 bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">No puede ser modificado</p>
              </div>

              <div>
                <Label htmlFor="cargo">Cargo</Label>
                <Input
                  id="cargo"
                  value={perfil.cargo || ""}
                  disabled
                  className="mt-1 bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {perfil.role === "admin" ? "Contacta a otro administrador" : "Contacta a un administrador"} para cambiar tu cargo
                </p>
              </div>

              <div>
                <Label htmlFor="bio">Acerca de ti</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Cuéntanos sobre ti..."
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <Button onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Guardar cambios
              </Button>
            </div>
          </Card>

          {/* Professional Context Section */}
          {teamContext && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contexto profesional</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">{teamContext.roleTitle}</h4>
                  <p className="text-sm text-gray-600 mt-1">{teamContext.roleSummary}</p>
                </div>

                {teamContext.specialties.length > 0 && (
                  <div>
                    <Label className="block mb-2">Especialidades</Label>
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
                    <Label className="block mb-2">Responsabilidades</Label>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {teamContext.responsibilities.map((resp) => (
                        <li key={resp}>{resp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {teamContext.strengths.length > 0 && (
                  <div>
                    <Label className="block mb-2">Fortalezas</Label>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                      {teamContext.strengths.map((strength) => (
                        <li key={strength}>{strength}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {teamContext.typicalWork && (
                  <div>
                    <Label className="block mb-2">Trabajo típico</Label>
                    <p className="text-sm text-gray-700">{teamContext.typicalWork}</p>
                  </div>
                )}

                {teamContext.capacityHoursPerWeek > 0 && (
                  <div>
                    <Label className="block mb-2">Capacidad semanal</Label>
                    <p className="text-sm text-gray-700">{teamContext.capacityHoursPerWeek} horas/semana</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Security Section */}
          <Card className="p-6 border-red-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Seguridad</h3>
            <div className="space-y-4">
              {perfil.passwordUpdatedAt && (
                <div className="p-3 bg-gray-50 rounded text-sm">
                  <p className="text-gray-600">
                    Contraseña actualizada:{" "}
                    <span className="font-medium">
                      {new Date(perfil.passwordUpdatedAt).toLocaleDateString("es-ES")}
                    </span>
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="current-password">Contraseña actual</Label>
                <div className="relative mt-1">
                  <Input
                    id="current-password"
                    type={passwordsVisible.current ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña actual"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordsVisible((p) => ({ ...p, current: !p.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {passwordsVisible.current ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <div className="relative mt-1">
                  <Input
                    id="new-password"
                    type={passwordsVisible.new ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordsVisible((p) => ({ ...p, new: !p.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {passwordsVisible.new ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirmar nueva contraseña</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirm-password"
                    type={passwordsVisible.confirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirma tu nueva contraseña"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordsVisible((p) => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {passwordsVisible.confirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
              >
                {isChangingPassword ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Cambiar contraseña
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
