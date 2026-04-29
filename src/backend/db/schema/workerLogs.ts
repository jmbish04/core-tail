import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const workerLogs = sqliteTable("worker_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workerName: text("worker_name").notNull(),
  eventTimestamp: integer("event_timestamp", { mode: "timestamp" }).notNull(),
  outcome: text("outcome").notNull(), // 'ok', 'exception', 'canceled', 'exceededCpu', 'exceededMemory', 'unknown'
  scriptName: text("script_name"),
  logs: text("logs"), // JSON string of log entries
  exceptions: text("exceptions"), // JSON string of exception data
  statusCode: integer("status_code"),
  requestUrl: text("request_url"),
  requestMethod: text("request_method"),
});
