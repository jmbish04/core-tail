/**
 * @fileoverview Core-Tail Worker Logger Utility
 *
 * This logger intercepts internal worker logs and forwards them to both:
 * 1. D1 database for persistence
 * 2. LogStreamer Durable Object for real-time WebSocket broadcasting
 */

import { drizzle } from "drizzle-orm/d1";
import type { ExecutionContext } from "@cloudflare/workers-types";

import { metaInternalLogs } from "../db/schema";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerEnv {
  DB: D1Database;
  LOG_STREAMER?: DurableObjectNamespace;
}

export class WorkerLogger {
  private env: LoggerEnv;
  private ctx: ExecutionContext;
  private workerName: string;

  constructor(env: LoggerEnv, ctx: ExecutionContext, workerName = "core-tail") {
    this.env = env;
    this.ctx = ctx;
    this.workerName = workerName;
  }

  /**
   * Log a message at the specified level
   */
  private async log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const timestamp = new Date();

    // Console logging for visibility
    const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(`[${level.toUpperCase()}] ${message}`, metadata || "");

    // Async operations that should complete even after response is sent
    const logPromise = (async () => {
      try {
        // 1. Persist to D1 database
        if (this.env.DB) {
          const db = drizzle(this.env.DB);
          await db.insert(metaInternalLogs).values({
            event: level.toUpperCase(),
            details: `${message}${metadata ? ` | ${JSON.stringify(metadata)}` : ""}`,
            timestamp,
          });
        }

        // 2. Forward to LogStreamer Durable Object for real-time broadcasting
        if (this.env.LOG_STREAMER) {
          const doId = this.env.LOG_STREAMER.idFromName("global-streamer");
          const streamer = this.env.LOG_STREAMER.get(doId);

          await streamer.fetch("http://do/ingest", {
            method: "POST",
            body: JSON.stringify({
              source: this.workerName,
              outcome: level === "error" ? "exception" : "ok",
              logs: [{
                level,
                message,
                timestamp: timestamp.toISOString(),
              }],
              exceptions: level === "error" ? [{
                name: "WorkerError",
                message,
                timestamp: timestamp.toISOString(),
              }] : undefined,
              timestamp: timestamp.toISOString(),
              metadata,
            }),
          });
        }
      } catch (error) {
        console.error("Failed to persist/broadcast log:", error);
      }
    })();

    // Ensure log operations complete
    this.ctx.waitUntil(logPromise);
  }

  /**
   * Log debug message
   */
  debug(message: string, metadata?: Record<string, any>) {
    return this.log("debug", message, metadata);
  }

  /**
   * Log info message
   */
  info(message: string, metadata?: Record<string, any>) {
    return this.log("info", message, metadata);
  }

  /**
   * Log warning message
   */
  warn(message: string, metadata?: Record<string, any>) {
    return this.log("warn", message, metadata);
  }

  /**
   * Log error message
   */
  error(message: string, metadata?: Record<string, any>) {
    return this.log("error", message, metadata);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(env: LoggerEnv, ctx: ExecutionContext, workerName = "core-tail"): WorkerLogger {
  return new WorkerLogger(env, ctx, workerName);
}
