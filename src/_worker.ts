/**
 * @fileoverview Cloudflare Workers entry point
 */

import type { ExportedHandler, TraceItem } from "@cloudflare/workers-types";

import { drizzle } from "drizzle-orm/d1";
import { app as honoApp } from "./backend/api/index";
import { logs } from "./backend/db/schema";
import type { Bindings } from './backend/api/index';

const handler: ExportedHandler<Bindings> = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle API and Documentation routes
    if (
      url.pathname.startsWith('/api/') || 
      url.pathname === '/openapi.json' || 
      url.pathname === '/swagger' || 
      url.pathname === '/scalar' || 
      url.pathname === '/docs'
    ) {
      return honoApp.fetch(request, env, ctx);
    }

    // Let Astro handle everything else via the ASSETS binding
    return env.ASSETS.fetch(request);
  },

  async tail(events, env, ctx) {
    if (!env.DB) {
      console.error("DB binding not found");
      return;
    }

    const db = drizzle(env.DB);
    const logsToInsert = [];

    for (const event of events) {
      const workerName = event.scriptName || "unknown_worker";
      const timestamp = new Date(event.eventTimestamp);

      for (const log of event.logs) {
        logsToInsert.push({
          workerName,
          level: log.level,
          message: typeof log.message === "string" ? log.message : JSON.stringify(log.message),
          metadata: JSON.stringify({
            event: event.event,
            diagnosticsChannelEvents: event.diagnosticsChannelEvents,
            exceptions: event.exceptions,
          }),
          timestamp: timestamp,
        });
      }

      for (const exception of event.exceptions) {
        logsToInsert.push({
          workerName,
          level: "error",
          message: exception.name + ": " + exception.message,
          metadata: JSON.stringify({
            event: event.event,
            diagnosticsChannelEvents: event.diagnosticsChannelEvents,
            exceptions: event.exceptions,
          }),
          timestamp: timestamp,
        });
      }
    }

    if (logsToInsert.length > 0) {
      try {
        await db.insert(logs).values(logsToInsert).execute();
      } catch (err) {
        console.error("Failed to insert logs to DB", err);
      }
    }
  },
};

export default handler;

export { LogAnalyzerAgent } from "./backend/agent";
