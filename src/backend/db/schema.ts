/**
 * @fileoverview Database schema definitions using drizzle-orm.
 *
 * This file defines the database schema using drizzle-orm for the complete application.
 * It includes tables for authentication, dashboard metrics, AI threads, and system health.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const workerLogs = sqliteTable('worker_logs', {
  id: integer('id').primary key({ autoIncrement: true }),
  workerName: text('worker_name').notNull(),
  eventTimestamp: integer('event_timestamp', { mode: 'timestamp' })
    .default(sql`(strftime('%s', 'now'))`),
  outcome: text('outcome'), // 'ok', 'exception', 'canceled'
  scriptName: text('script_name'),
  logs: text('logs'), // Stringified JSON
  exceptions: text('exceptions'), // Stringified JSON
  statusCode: integer('status_code'),
});

/**
 * Worker Logs table for centralized logging
 */
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
