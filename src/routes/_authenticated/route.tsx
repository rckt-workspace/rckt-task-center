import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Check if user is active
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
    }

    // Inactive users cannot access the app
    if (profile && !profile.is_active) {
      throw redirect({ to: "/auth" });
    }

    // must_change_password is no longer a blocker - it's handled as a dashboard alert
    return { user: data.user };
  },
  component: () => <Outlet />,
});
