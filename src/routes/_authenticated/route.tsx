import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function isTransientAuthError(error: unknown): boolean {
  if (!error) return false;

  const err = error as Record<string, unknown>;

  // Retryable fetch errors
  if (err["name"] === "AuthRetryableFetchError") return true;

  // Network/HTTP status errors
  const status = err["status"] as number | undefined;
  if (status === 0) return true; // Network error
  if (status && status >= 500) return true; // Server error

  // Error message patterns
  const message = (err["message"] as string)?.toLowerCase() ?? "";
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("temporarily") ||
    message.includes("load failed")
  ) {
    return true;
  }

  return false;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Step A: Get session
    let { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    let session = sessionData?.session;

    // Step B: If transient error, retry once after 300ms
    if (isTransientAuthError(sessionError) && !session) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const retry = await supabase.auth.getSession();
      if (!retry.error) {
        sessionData = retry.data;
        session = retry.data?.session;
        sessionError = null;
      }
    }

    // Step C: If no session, redirect to auth
    if (!session) {
      throw redirect({ to: "/auth" });
    }

    let validatedSession = session;

    // Step D: Validate claims with existing session
    try {
      const { data: claimsData, error: claimsError } =
        await supabase.auth.getClaims(session.access_token);
      const claims = claimsData?.claims;

      if (claimsError) {
        if (isTransientAuthError(claimsError)) {
          // Transient error: keep current session and log warning
          console.warn(
            "Transient error validating token claims, continuing with current session:",
            claimsError
          );
        } else {
          // Definitive error: try refresh once
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();

          if (refreshData?.session) {
            // Step E: Validate refreshed session claims
            const { data: refreshClaimsData, error: refreshClaimsError } =
              await supabase.auth.getClaims(refreshData.session.access_token);
            const refreshClaims = refreshClaimsData?.claims;

            if (refreshClaimsError) {
              if (isTransientAuthError(refreshClaimsError)) {
                // Transient: keep refreshed session
                console.warn(
                  "Transient error validating refreshed token, continuing:",
                  refreshClaimsError
                );
                validatedSession = refreshData.session;
              } else {
                // Definitive: sign out and redirect
                await supabase.auth.signOut({ scope: "local" });
                throw redirect({ to: "/auth" });
              }
            } else if (refreshClaims?.sub !== refreshData.session.user.id) {
              // Invalid token after refresh
              await supabase.auth.signOut({ scope: "local" });
              throw redirect({ to: "/auth" });
            } else {
              // Valid refreshed session
              validatedSession = refreshData.session;
            }
          } else {
            // Refresh failed: sign out and redirect
            await supabase.auth.signOut({ scope: "local" });
            throw redirect({ to: "/auth" });
          }
        }
      } else if (!claims || claims.sub !== session.user.id) {
        // No claims or subject mismatch: try refresh
        const { data: refreshData, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshData?.session) {
          const { data: refreshClaimsData, error: refreshClaimsError } =
            await supabase.auth.getClaims(refreshData.session.access_token);
          const refreshClaims = refreshClaimsData?.claims;

          if (refreshClaimsError) {
            if (isTransientAuthError(refreshClaimsError)) {
              console.warn(
                "Transient error validating refreshed token, continuing:",
                refreshClaimsError
              );
              validatedSession = refreshData.session;
            } else {
              await supabase.auth.signOut({ scope: "local" });
              throw redirect({ to: "/auth" });
            }
          } else if (refreshClaims?.sub !== refreshData.session.user.id) {
            await supabase.auth.signOut({ scope: "local" });
            throw redirect({ to: "/auth" });
          } else {
            validatedSession = refreshData.session;
          }
        } else {
          await supabase.auth.signOut({ scope: "local" });
          throw redirect({ to: "/auth" });
        }
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      console.error("Unexpected error during token validation:", err);
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }

    // Step F: Check if user is active
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", validatedSession.user.id)
        .single();

      if (profileError) {
        if (isTransientAuthError(profileError)) {
          console.warn(
            "Transient error checking profile.is_active, continuing:",
            profileError
          );
        } else {
          console.error("Error fetching profile:", profileError);
        }
      } else if (profile && !profile.is_active) {
        // User is inactive: sign out and redirect
        await supabase.auth.signOut({ scope: "local" });
        throw redirect({ to: "/auth" });
      }
    } catch (err) {
      if (isRedirect(err)) throw err;
      console.warn("Error during profile validation:", err);
    }

    // Step G: Return validated user
    return { user: validatedSession.user };
  },
  component: () => <Outlet />,
});
