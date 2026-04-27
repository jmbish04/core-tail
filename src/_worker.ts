/**
 * @fileoverview Cloudflare Workers entry point
 *
 * This file integrates the Hono API with Astro SSR and handles tail events.
 */
import type { ExportedHandler, ExecutionContext } from "@cloudflare/workers-types";

import { drizzle } from "drizzle-orm/d1";

import type { Bindings } from "./backend/api/index";
import type { TailEvent, TraceEvent } from "./backend/types";

import { app as honoApp } from "./backend/api/index";
import { workerLogs, logs } from "./backend/db/schema";

const handler: ExportedHandler<Bindings> = {
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

  async tail(events: any, env: any, ctx: any) {
    // Process tail events and batch insert into D1
    const db = drizzle(env.DB);

    const logsToInsert: any[] = [];
    const workerLogsEntries: any[] = [];

    for (const event of events) {
      const workerName = event.scriptName || "unknown";
      const timestamp = new Date(event.eventTimestamp);

      // Keep upstream workerLogs logic
      workerLogsEntries.push({
        workerName: workerName,
        eventTimestamp: timestamp,
        outcome: event.outcome,
        scriptName: event.scriptName || null,
        logs: event.logs ? JSON.stringify(event.logs) : null,
        exceptions: event.exceptions ? JSON.stringify(event.exceptions) : null,
        statusCode: event.event?.response?.status || null,
        requestUrl: event.event?.request?.url || null,
        requestMethod: event.event?.request?.method || null,
      });

      // Keep feature branch logic
      if (event.logs) {
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
      }

      if (event.exceptions) {
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
    }

    // Use waitUntil to batch insert without blocking the tail handler
    ctx.waitUntil(
      (async () => {
        try {
          if (workerLogsEntries.length > 0) {
            await db.insert(workerLogs).values(workerLogsEntries);
          }
          if (logsToInsert.length > 0) {
            await db.insert(logs).values(logsToInsert);
          }
        } catch (error) {
          console.error("Error inserting worker logs:", error);
        }
      })(),
    );
  },
};

export default handler;

export { LogAnalyzerAgent } from "./backend/agent";
