/**
 * @fileoverview Cloudflare Workers entry point
 *
 * This file integrates the Hono API with Astro SSR and handles tail events.
 */
import type { ExportedHandler, ExecutionContext } from "@cloudflare/workers-types";

// import type { Bindings } from "./backend/api/index";

import { app as honoApp } from "./backend/api/index";
import { processTailEvents } from "./backend/services/tailHandler";

const handler: ExportedHandler<Env> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle API and Documentation routes
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname === "/openapi.json" ||
      url.pathname === "/swagger" ||
      url.pathname === "/scalar" ||
      url.pathname === "/docs"
    ) {
      return honoApp.fetch(request, env, ctx);
    }

    // Let Astro handle everything else via the ASSETS binding
    return env.ASSETS.fetch(request);
  },

async tail(events: TraceItem[], env: Env, ctx: ExecutionContext) {
    await processTailEvents(events, env, ctx);
  },
};

export default handler;

export { LogAnalyzerAgent } from "./backend/agent";
export { LogStreamer } from "./backend/do/LogStreamer";
