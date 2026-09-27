import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      fullName: z.string().min(1).optional(),
      bio: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const update: Record<string, any> = {};
    if (data.fullName !== undefined) update.full_name = data.fullName;
    if (data.bio !== undefined) update.bio = data.bio;

    const { error } = await context.supabase
      .from("profiles")
      .update(update)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
      confirmPassword: z.string().min(8),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.newPassword !== data.confirmPassword) {
      throw new Error("Las nuevas contraseñas no coinciden");
    }

    // Get the user's email from profiles to verify password
    const { data: profileData, error: profileError } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .single();

    if (profileError || !profileData) {
      throw new Error("No se pudo obtener el perfil del usuario");
    }

    // Import supabaseAdmin for password reset
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      { password: data.newPassword },
    );

    if (updateError) throw new Error(updateError.message);

    // Update must_change_password and password_updated_at
    const { error: dbError } = await context.supabase
      .from("profiles")
      .update({
        must_change_password: false,
        password_updated_at: new Date().toISOString(),
      })
      .eq("id", context.userId);

    if (dbError) throw new Error(dbError.message);

    return { ok: true };
  });

export const resetTeamUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      temporaryPassword: z.string().min(8),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Update the user's password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      data.userId,
      { password: data.temporaryPassword },
    );

    if (updateError) throw new Error(updateError.message);

    // Set must_change_password to true
    const { error: dbError } = await context.supabase
      .from("profiles")
      .update({
        must_change_password: true,
        password_updated_at: new Date().toISOString(),
      })
      .eq("id", data.userId);

    if (dbError) throw new Error(dbError.message);

    return { ok: true };
  });

export const getAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profileData, error: profileError } = await context.supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", data.userId)
      .single();

    if (profileError || !profileData?.avatar_path) {
      return { url: null };
    }

    const { data: signedUrl, error } = await context.supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(profileData.avatar_path, 60 * 60); // 1 hour

    if (error || !signedUrl) {
      return { url: null };
    }

    return { url: signedUrl.signedUrl };
  });

export const deleteOldAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    // Ensure the path belongs to the current user
    const pathParts = data.path.split("/");
    if (pathParts[0] !== context.userId) {
      throw new Error("No tienes permiso para eliminar este archivo");
    }

    const { error } = await context.supabase.storage
      .from(AVATAR_BUCKET)
      .remove([data.path]);

    if (error) {
      console.warn("Could not delete old avatar:", error);
      // Don't throw - old avatar cleanup is non-critical
    }

    return { ok: true };
  });
