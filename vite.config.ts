// @lovable.dev/vite-tanstack-config manages the TanStack Start,
// React, Tailwind, tsconfig paths and Nitro configuration required
// by the Lovable runtime.
//
// The project is now published through Lovable, so we intentionally
// do not override Nitro with a Render-specific preset.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
    },
  },
});
