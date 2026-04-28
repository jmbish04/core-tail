import type { ExecutionContext } from "@cloudflare/workers-types";

import { drizzle } from "drizzle-orm/d1";

import { workerLogs, logs, metaInternalLogs } from "../db/schema";

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
    const kvPromises: Promise<void>[] = [];
    const metaLogsToInsert: any[] = [];
    const streamerData: any[] = []; // Collect all logs to broadcast in a single payload

    // Helper to log core-tail's internal events, mirror them to D1, and push them to the WebSocket
    const addCoreTailLog = (level: string, eventName: string, details: string) => {
      const ts = new Date();
      console[level === "error" ? "error" : "info"](`[Tail] ${details}`);

      metaLogsToInsert.push({
        event: eventName,
        details: details,
        timestamp: ts,
      });

      logsToInsert.push({
        workerName: "core-tail",
        level: level,
        message: details,
        metadata: JSON.stringify({ event: eventName }),
        timestamp: ts,
      });

      streamerData.push({
        id: ts.getTime() + Math.random(),
        workerName: "core-tail",
        level: level,
        message: details,
        timestamp: ts.toISOString(),
        metadata: { event: eventName },
      });
    };

    // Log internal observability event
    addCoreTailLog("info", "RECEIVE_BATCH", `Processing ${events.length} tail events`);

    for (const event of events) {
      const workerName = event.scriptName || "unknown";
      const timestamp = new Date(event.eventTimestamp);
      const eventId = `${timestamp.getTime()}-${Math.random().toString(36).substring(7)}`;

      addCoreTailLog(
        "info",
        "PROCESS_EVENT",
        `Processing ${event.logs?.length || 0} logs from ${workerName}, outcome: ${event.outcome}`,
      );

      // RAW LOG PERSISTENCE: Store raw event in KV before processing
      if (env.RAW_LOGS) {
        const rawKey = `raw:${timestamp.getTime()}:${workerName}:${eventId}`;
        const rawValue = JSON.stringify(event);
        kvPromises.push(
          env.RAW_LOGS.put(rawKey, rawValue, {
            expirationTtl: 86400 * 7, // 7 days retention
          }).catch((error: Error) => {
            console.error(`Error storing raw log to KV: ${error.message}`);
          }),
        );
      }

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

      // Format upstream events for WebSocket broadcast ensuring it matches the expected structure
      streamerData.push({
        id: timestamp.getTime(),
        workerName: workerName,
        outcome: event.outcome,
        eventTimestamp: timestamp.toISOString(),
        logs: event.logs,
        exceptions: event.exceptions,
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

    addCoreTailLog(
      "info",
      "BATCH_COMPLETE",
      `Successfully processed ${workerLogsEntries.length} worker_logs and ${logsToInsert.length} granular logs.`,
    );

    // Broadcast all events (Tail Logs + Internal core-tail logs) to Durable Object
    if (env.LOG_STREAMER && streamerData.length > 0) {
      try {
        const doId = env.LOG_STREAMER.idFromName("global-streamer");
        const streamer = env.LOG_STREAMER.get(doId);
        await streamer.fetch("http://do/ingest", {
          method: "POST",
          body: JSON.stringify({
            type: "logs",
            data: streamerData,
          }),
        });
      } catch (error) {
        console.error("Error broadcasting to LogStreamer DO:", error);
      }
    }

    // Wait for all KV writes to complete
    await Promise.all(kvPromises);

    // Batch insert to D1
    try {
      if (workerLogsEntries.length > 0) {
        await db.insert(workerLogs).values(workerLogsEntries);
      }
      if (logsToInsert.length > 0) {
        await db.insert(logs).values(logsToInsert);
      }
      if (metaLogsToInsert.length > 0) {
        await db.insert(metaInternalLogs).values(metaLogsToInsert);
      }
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
