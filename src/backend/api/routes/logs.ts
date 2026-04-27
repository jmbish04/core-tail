/**
 * @fileoverview API routes for worker logs with OpenAPI integration
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { workerLogs } from '../../db/schema';
import { desc, eq, sql, and, gte } from 'drizzle-orm';
import type { Bindings } from '../index';
import { getLogsRoute, getWorkersListRoute, getLogsStatsRoute, getLogByIdRoute } from './openapi';

const logsRouter = new OpenAPIHono<{ Bindings: Bindings }>();

/**
 * Safely parse JSON with fallback to null on error
 */
function safeJsonParse(jsonString: string | null): any {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}

/**
 * GET /api/logs
 * Get filtered worker logs
 */
logsRouter.openapi(getLogsRoute, async (c) => {
  const { workerName, outcome, limit, offset, since } = c.req.valid('query');
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
    .select({ count: sql<number>`count(*)`.as('count') })
    .from(workerLogs)
    .where(whereClause);

  const totalCount = Number(countResult.count);

  // Get paginated logs
  const logs = await db
    .select()
    .from(workerLogs)
    .where(whereClause)
    .orderBy(desc(workerLogs.eventTimestamp))
    .limit(limit)
    .offset(offset);

  // Parse JSON fields with error handling
  const parsedLogs = logs.map(log => ({
    ...log,
    eventTimestamp: log.eventTimestamp.toISOString(),
    logs: safeJsonParse(log.logs),
    exceptions: safeJsonParse(log.exceptions),
  }));

  return c.json({
    logs: parsedLogs,
    pagination: {
      limit,
      offset,
      total: totalCount,
    },
  });
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

  return c.json({
    workers: workers.map(w => w.workerName),
  });
});

/**
 * GET /api/logs/stats
 * Get error rate statistics
 */
logsRouter.openapi(getLogsStatsRoute, async (c) => {
  const { workerName } = c.req.valid('query');
  const db = drizzle(c.env.DB);

  // Build where clause for optional workerName filter
  const whereClause = workerName ? eq(workerLogs.workerName, workerName) : undefined;

  // Get total counts by outcome
  const outcomeCounts = await db
    .select({
      outcome: workerLogs.outcome,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(workerLogs)
    .where(whereClause)
    .groupBy(workerLogs.outcome);

  // Get counts per worker
  const workerStats = await db
    .select({
      workerName: workerLogs.workerName,
      outcome: workerLogs.outcome,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(workerLogs)
    .where(whereClause)
    .groupBy(workerLogs.workerName, workerLogs.outcome);

  // Calculate error rates
  const totalLogs = outcomeCounts.reduce((sum, item) => sum + Number(item.count), 0);
  const errorCount = outcomeCounts
    .filter(item => item.outcome !== 'ok')
    .reduce((sum, item) => sum + Number(item.count), 0);

  const errorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;

  return c.json({
    overview: {
      totalLogs,
      errorCount,
      errorRate: parseFloat(errorRate.toFixed(2)),
    },
    byOutcome: outcomeCounts.map(item => ({
      outcome: item.outcome,
      count: Number(item.count),
    })),
    byWorker: workerStats.reduce((acc, item) => {
      const workerName = item.workerName;
      if (!acc[workerName]) {
        acc[workerName] = {};
      }
      acc[workerName][item.outcome] = Number(item.count);
      return acc;
    }, {} as Record<string, Record<string, number>>),
  });
});

/**
 * GET /api/logs/:id
 * Get a specific log entry by ID
 */
logsRouter.openapi(getLogByIdRoute, async (c) => {
  const { id } = c.req.valid('param');
  const db = drizzle(c.env.DB);

  const log = await db
    .select()
    .from(workerLogs)
    .where(eq(workerLogs.id, id))
    .limit(1);

  if (log.length === 0) {
    return c.json({ error: 'Log not found' }, 404);
  }

  const parsedLog = {
    ...log[0],
    eventTimestamp: log[0].eventTimestamp.toISOString(),
    logs: safeJsonParse(log[0].logs),
    exceptions: safeJsonParse(log[0].exceptions),
  };

  return c.json({ log: parsedLog });
});

export { logsRouter };
