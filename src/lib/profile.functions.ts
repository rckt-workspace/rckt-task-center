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
    const update: Partial<Record<"full_name" | "bio", string>> = {};
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

    // Get the user's email from profiles (user can read own profile by RLS)
    const { data: profileData, error: profileError } = await context.supabase
      .from("profiles")
      .select("email")
      .eq("id", context.userId)
      .single();

    if (profileError || !profileData?.email) {
      throw new Error("No se pudo obtener el email del usuario");
    }

    const userEmail = profileData.email;

    // Verify current password by attempting to sign in
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabasePublicKey = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublicKey) {
      throw new Error("Configuración de Supabase incompleta");
    }

    const verifyClient = createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: userEmail,
      password: data.currentPassword,
    });

    if (signInError) {
      throw new Error("La contraseña actual es incorrecta");
    }

    // Only after verification: update password using supabaseAdmin
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      { password: data.newPassword },
    );

    if (updateError) throw new Error(updateError.message);

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

    return { ok: true };
  });

export const getAvatarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Query using RPC to securely get avatar path of active team members
    const { data: avatarPath, error: rpcError } = await (context.supabase.rpc as any)(
      "get_team_member_avatar",
      { _user_id: data.userId }
    );

    if (rpcError || !avatarPath) {
      return { url: null };
    }

    const { data: signedUrl, error } = await context.supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarPath, 60 * 60); // 1 hour

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
