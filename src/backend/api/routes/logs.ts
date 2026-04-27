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

  const logs = await db
    .select()
    .from(workerLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(workerLogs.eventTimestamp))
    .limit(limit)
    .offset(offset);

  // Parse JSON fields
  const parsedLogs = logs.map(log => ({
    ...log,
    eventTimestamp: log.eventTimestamp.toISOString(),
    logs: log.logs ? JSON.parse(log.logs) : null,
    exceptions: log.exceptions ? JSON.parse(log.exceptions) : null,
  }));

  return c.json({
    logs: parsedLogs,
    pagination: {
      limit,
      offset,
      total: logs.length,
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
  const db = drizzle(c.env.DB);

  // Get total counts by outcome
  const outcomeCounts = await db
    .select({
      outcome: workerLogs.outcome,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(workerLogs)
    .groupBy(workerLogs.outcome);

  // Get counts per worker
  const workerStats = await db
    .select({
      workerName: workerLogs.workerName,
      outcome: workerLogs.outcome,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(workerLogs)
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
    logs: log[0].logs ? JSON.parse(log[0].logs) : null,
    exceptions: log[0].exceptions ? JSON.parse(log[0].exceptions) : null,
  };

  return c.json({ log: parsedLog });
});

export { logsRouter };
