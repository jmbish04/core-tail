// @ts-check
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = process.env.SITE ?? "http://localhost:4321";
const base = process.env.BASE || "/";

export default defineConfig({
  site,
  srcDir: "./src/frontend", // Ensure your Astro files are here
  base,
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
    platformProxy: {
      enabled: true,
      // This allows local dev to "see" your KV namespace
      bindings: {
        SESSIONS: {
          type: "kv",
        },
      },
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      rollupOptions: {
        external: ["cloudflare:workers"],
      },
    },
  },
});
