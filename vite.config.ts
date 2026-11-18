// @lovable.dev/vite-tanstack-config manages the TanStack Start,
// React, Tailwind, tsconfig paths and Nitro configuration required
// by the Lovable runtime.
//
// The project is now published through Lovable, so we intentionally
// do not override Nitro with a Render-specific preset.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import {
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL,
} from "./src/config/supabase-public";

// .env is not tracked in git, so builds from the repository may lack the
// public VITE_* values. Fall back to the versioned public config so the
// browser bundle always receives them (only public values; never secrets).
process.env["VITE_SUPABASE_URL"] ||= PUBLIC_SUPABASE_URL;
process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||= PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
