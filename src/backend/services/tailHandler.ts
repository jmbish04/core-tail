import { drizzle } from "drizzle-orm/d1";
import { workerLogs, logs } from "../db/schema";
import type { ExecutionContext } from "@cloudflare/workers-types";

export async function processTailEvents(events: any[], env: any, ctx: ExecutionContext) {
  if (!env.DB) {
    console.error("DB binding not found");
    return;
  }

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
}
