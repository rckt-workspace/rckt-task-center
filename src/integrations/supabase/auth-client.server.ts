import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

interface CreateSupabaseFetch {
  (supabaseKey: string): typeof fetch;
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

const createSupabaseFetch: CreateSupabaseFetch = (supabaseKey: string) => {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
};

export interface AuthenticatedSupabaseContext {
  client: ReturnType<typeof createClient<Database>>;
  userId: string;
}

export async function createAuthenticatedSupabaseClient(
  accessToken: string,
): Promise<AuthenticatedSupabaseContext> {
  console.log("[ChatAuth] creating authenticated client");

  const SUPABASE_URL = process.env["SUPABASE_URL"];
  const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variables: ${missing.join(", ")}`);
  }

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("[ChatAuth] validating claims");
  const { data, error } = await client.auth.getClaims(accessToken);

  if (error) {
    console.error("[ChatAuth] claims error:", {
      name: error.name,
      message: error.message,
    });
    throw error;
  }

  if (!data?.claims?.sub) {
    console.error("[ChatAuth] invalid claims: missing sub");
    throw new Error("Invalid or expired authentication token");
  }

  console.log("[ChatAuth] claims valid");

  return {
    client,
    userId: data.claims.sub,
  };
}
