import { drizzle } from "drizzle-orm/d1";
import { workerLogs, logs, metaInternalLogs } from "../db/schema";
import type { ExecutionContext } from "@cloudflare/workers-types";

export async function processTailEvents(events: any[], env: any, ctx: ExecutionContext) {
  if (!env.DB) {
    console.error("DB binding not found");
    return;
  }

  const db = drizzle(env.DB);

  // CRITICAL: Wrap all async operations in ctx.waitUntil to prevent premature worker termination
  const processingPromise = (async () => {
    const logsToInsert: any[] = [];
    const workerLogsEntries: any[] = [];

    // Log internal observability event
    console.info(`[Tail] Processing ${events.length} tail events`);
    await db.insert(metaInternalLogs).values({
      event: "RECEIVE_BATCH",
      details: `Processing ${events.length} tail events`,
      timestamp: new Date(),
    });

    for (const event of events) {
      const workerName = event.scriptName || "unknown";
      const timestamp = new Date(event.eventTimestamp);

      // Log per-event observability
      console.info(
        `[Tail] Processing ${event.logs?.length || 0} logs from ${workerName}, outcome: ${event.outcome}`
      );

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

      // Broadcast to Durable Object for real-time streaming
      if (env.LOG_STREAMER) {
        try {
          const doId = env.LOG_STREAMER.idFromName("global-streamer");
          const streamer = env.LOG_STREAMER.get(doId);
          await streamer.fetch("http://do/ingest", {
            method: "POST",
            body: JSON.stringify({
              source: workerName,
              outcome: event.outcome,
              logs: event.logs,
              exceptions: event.exceptions,
              timestamp: event.eventTimestamp,
            }),
          });
        } catch (error) {
          console.error("Error broadcasting to LogStreamer DO:", error);
        }
      }
    }

    // Batch insert to D1
    try {
      if (workerLogsEntries.length > 0) {
        await db.insert(workerLogs).values(workerLogsEntries);
        console.info(`[Tail] Inserted ${workerLogsEntries.length} entries to worker_logs`);
      }
      if (logsToInsert.length > 0) {
        await db.insert(logs).values(logsToInsert);
        console.info(`[Tail] Inserted ${logsToInsert.length} entries to logs`);
      }

      // Log successful processing
      await db.insert(metaInternalLogs).values({
        event: "BATCH_COMPLETE",
        details: `Successfully inserted ${workerLogsEntries.length} worker_logs and ${logsToInsert.length} logs`,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error inserting worker logs:", error);
      await db.insert(metaInternalLogs).values({
        event: "BATCH_ERROR",
        details: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: new Date(),
      });
    }
  })();

  // CRITICAL: Ensure async operations complete before worker terminates
  ctx.waitUntil(processingPromise);
}
