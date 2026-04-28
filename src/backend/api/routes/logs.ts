/**
 * @fileoverview API routes for worker logs with OpenAPI integration
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { zValidator } from "@hono/zod-validator";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";

import type { Bindings } from "../index";

import { workerLogs, logs } from "../../db/schema";
import { getLogsRoute, getWorkersListRoute, getLogsStatsRoute, getLogByIdRoute } from "./openapi";

const logsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

/**
 * Safely parse JSON with fallback to null on error
 */
function safeJsonParse(jsonString: string | null): any {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
}

/**
 * GET /api/logs
 * Get filtered worker logs
 */
logsRouter.openapi(getLogsRoute, async (c) => {
  const { workerName, outcome, limit, offset, since } = c.req.valid("query");
  const db = drizzle(c.env.DB);

  const conditions = [];

  if (workerName) {
    conditions.push(eq(workerLogs.workerName, workerName));
  }

  if (outcome) {
    conditions.push(eq(workerLogs.outcome, outcome));
  }

  if (since) {
    const sinceDate = new Date(since);
    conditions.push(gte(workerLogs.eventTimestamp, sinceDate));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count for pagination
  const [countResult] = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(workerLogs)
    .where(whereClause);

  const totalCount = Number(countResult.count);

  // Get paginated logs
  const workerLogsResult = await db
    .select()
    .from(workerLogs)
    .where(whereClause)
    .orderBy(desc(workerLogs.eventTimestamp))
    .limit(limit)
    .offset(offset);

  // Parse JSON fields with error handling
  const parsedLogs = workerLogsResult.map((log) => ({
    ...log,
    outcome: log.outcome as
      | "unknown"
      | "ok"
      | "canceled"
      | "exception"
      | "exceededCpu"
      | "exceededMemory",
    eventTimestamp: log.eventTimestamp.toISOString(),
    logs: safeJsonParse(log.logs),
    exceptions: safeJsonParse(log.exceptions),
  }));

  return c.json(
    {
      logs: parsedLogs,
      pagination: {
        limit,
        offset,
        total: totalCount,
      },
    },
    200,
  );
});

/**
 * GET /api/logs/workers
 * Get list of unique worker names
 */
logsRouter.openapi(getWorkersListRoute, async (c) => {
  const db = drizzle(c.env.DB);

  const workers = await db
    .selectDistinct({ workerName: workerLogs.workerName })
    .from(workerLogs)
    .orderBy(workerLogs.workerName);

  return c.json(
    {
      workers: workers.map((w) => w.workerName),
    },
    200,
  );
});

/**
 * GET /api/logs/stats
 * Get error rate statistics
 */
logsRouter.openapi(getLogsStatsRoute, async (c) => {
  const { workerName } = c.req.valid("query");
  const db = drizzle(c.env.DB);

  // Build where clause for optional workerName filter
  const whereClause = workerName ? eq(workerLogs.workerName, workerName) : undefined;

  // Get total counts by outcome
  const outcomeCounts = await db
    .select({
      outcome: workerLogs.outcome,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(workerLogs)
    .where(whereClause)
    .groupBy(workerLogs.outcome);

  // Get counts per worker
  const workerStats = await db
    .select({
      workerName: workerLogs.workerName,
      outcome: workerLogs.outcome,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(workerLogs)
    .where(whereClause)
    .groupBy(workerLogs.workerName, workerLogs.outcome);

  // Calculate error rates
  const totalLogs = outcomeCounts.reduce((sum, item) => sum + Number(item.count), 0);
  const errorCount = outcomeCounts
    .filter((item) => item.outcome !== "ok")
    .reduce((sum, item) => sum + Number(item.count), 0);

  const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;

  return c.json(
    {
      overview: {
        totalLogs,
        errorCount,
        errorRate: parseFloat(errorRate.toFixed(2)),
      },
      byOutcome: outcomeCounts.map((item) => ({
        outcome: item.outcome,
        count: Number(item.count),
      })),
      byWorker: workerStats.reduce(
        (acc, item) => {
          const workerName = item.workerName;
          if (!acc[workerName]) {
            acc[workerName] = {};
          }
          acc[workerName][item.outcome] = Number(item.count);
          return acc;
        },
        {} as Record<string, Record<string, number>>,
      ),
    },
    200,
  );
});

/**
 * GET /api/logs/:id
 * Get a specific log entry by ID
 */
logsRouter.openapi(getLogByIdRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = drizzle(c.env.DB);

  const log = await db.select().from(workerLogs).where(eq(workerLogs.id, id)).limit(1);

  if (log.length === 0) {
    return c.json({ error: "Log not found" }, 404);
  }

  const parsedLog = {
    ...log[0],
    outcome: log[0].outcome as
      | "unknown"
      | "ok"
      | "canceled"
      | "exception"
      | "exceededCpu"
      | "exceededMemory",
    eventTimestamp: log[0].eventTimestamp.toISOString(),
    logs: safeJsonParse(log[0].logs),
    exceptions: safeJsonParse(log[0].exceptions),
  };

  return c.json({ log: parsedLog }, 200);
});

// Feature Branch Compatibility API

logsRouter.get(
  "/legacy",
  zValidator(
    "query",
    z.object({
      workerName: z.string().optional(),
      limit: z.string().optional().default("100"),
      offset: z.string().optional().default("0"),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { workerName, limit, offset } = c.req.valid("query");

    let query: any = db.select().from(logs).orderBy(desc(logs.timestamp));

    if (workerName && workerName !== "all") {
      query = db
        .select()
        .from(logs)
        .where(eq(logs.workerName, workerName))
        .orderBy(desc(logs.timestamp));
    }

    const results = await query.limit(parseInt(limit, 10)).offset(parseInt(offset, 10)).execute();

    return c.json(results, 200);
  },
);

logsRouter.get("/legacy/metrics", async (c) => {
  const db = drizzle(c.env.DB);
  const results = await db
    .select({
      workerName: logs.workerName,
      level: logs.level,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(logs)
    .groupBy(logs.workerName, logs.level)
    .execute();

  return c.json(results, 200);
});

/**
 * GET /api/logs/worker/:workerName/errors
 * Get unique errors for a specific worker with occurrence counts
 */
logsRouter.get("/worker/:workerName/errors", async (c) => {
  const { workerName } = c.req.param();
  const db = drizzle(c.env.DB);

  // Get all error logs for this worker
  const errorLogs = await db
    .select()
    .from(logs)
    .where(and(eq(logs.workerName, workerName), eq(logs.level, "error")))
    .orderBy(desc(logs.timestamp))
    .limit(1000); // Get last 1000 errors for analysis

  // Group errors by message to find unique errors
  const errorGroups = new Map<
    string,
    {
      message: string;
      count: number;
      firstSeen: Date;
      lastSeen: Date;
      exampleId: number;
      metadata: any;
    }
  >();

  for (const log of errorLogs) {
    // Normalize error message (remove dynamic parts like timestamps, IDs, etc.)
    const normalizedMessage = log.message
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g, "[TIMESTAMP]")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[UUID]")
      .replace(/\d+/g, "[NUMBER]");

    const existing = errorGroups.get(normalizedMessage);
    if (existing) {
      existing.count++;
      existing.lastSeen = log.timestamp > existing.lastSeen ? log.timestamp : existing.lastSeen;
    } else {
      errorGroups.set(normalizedMessage, {
        message: log.message,
        count: 1,
        firstSeen: log.timestamp,
        lastSeen: log.timestamp,
        exampleId: log.id,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
      });
    }
  }

  // Convert to array and sort by count
  const uniqueErrors = Array.from(errorGroups.values())
    .sort((a, b) => b.count - a.count)
    .map((error) => ({
      ...error,
      firstSeen: error.firstSeen.toISOString(),
      lastSeen: error.lastSeen.toISOString(),
    }));

  return c.json({ errors: uniqueErrors }, 200);
});

export { logsRouter };
