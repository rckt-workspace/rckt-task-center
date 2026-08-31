import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** true solo mientras no exista ninguna cuenta en el sistema. */
export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  return { needed: (count ?? 0) === 0 };
});

/** Crea la primera cuenta administradora. Se bloquea en cuanto exista una cuenta. */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        fullName: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Ya existe al menos una cuenta");

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, role: "admin" },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
