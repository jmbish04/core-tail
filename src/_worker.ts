/**
 * @fileoverview Cloudflare Workers entry point
 *
 * This file integrates the Hono API with Astro SSR and handles tail events.
 */
import type { ExportedHandler, ExecutionContext } from "@cloudflare/workers-types";
import type { Bindings } from "./backend/api/index";

import { processTailEvents } from "./backend/services/tailHandler";
import { processFetchEvent } from "./backend/services/fetchHandler";

const handler: ExportedHandler<Bindings> = {
  async fetch(request: any, env: any, ctx: ExecutionContext) {
    return processFetchEvent(request, env, ctx);
  },

  async tail(events: any, env: any, ctx: ExecutionContext) {
    await processTailEvents(events, env, ctx);
  },
};

export default handler;

export { LogAnalyzerAgent } from "./backend/agent";
