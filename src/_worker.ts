/**
 * @fileoverview Cloudflare Workers entry point
 *
 * This file integrates the Hono API with Astro SSR and handles tail events.
 */
import type { ExportedHandler, ExecutionContext } from '@cloudflare/workers-types';
import { app as honoApp } from './backend/api/index';
import type { Bindings } from './backend/api/index';
import type { TailEvent, TraceEvent } from './backend/types';
import { drizzle } from 'drizzle-orm/d1';
import { workerLogs } from './backend/db/schema';

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

  async tail(events: TailEvent, env: Bindings, ctx: ExecutionContext) {
    // Process tail events and batch insert into D1
    const db = drizzle(env.DB);

    const logEntries = events.events.map((event: TraceEvent) => ({
      workerName: event.scriptName || 'unknown',
      eventTimestamp: new Date(event.eventTimestamp),
      outcome: event.outcome,
      scriptName: event.scriptName || null,
      logs: event.logs ? JSON.stringify(event.logs) : null,
      exceptions: event.exceptions ? JSON.stringify(event.exceptions) : null,
      statusCode: event.event.response?.status || null,
      requestUrl: event.event.request?.url || null,
      requestMethod: event.event.request?.method || null,
    }));

    // Use waitUntil to batch insert without blocking the tail handler
    ctx.waitUntil(
      (async () => {
        try {
          if (logEntries.length > 0) {
            await db.insert(workerLogs).values(logEntries);
          }
        } catch (error) {
          console.error('Error inserting worker logs:', error);
        }
      })()
    );
  },
};

export default handler;