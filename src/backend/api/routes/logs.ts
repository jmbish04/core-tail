/**
 * @fileoverview API routes for worker logs
 *
 * Provides endpoints for querying worker logs, listing workers, and getting error statistics.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { workerLogs } from '../../db/schema';
import { desc, eq, sql, and, gte } from 'drizzle-orm';
import type { Bindings } from '../index';

const logsRouter = new Hono<{ Bindings: Bindings }>();

// Query params schema for filtering logs
const getLogsSchema = z.object({
  workerName: z.string().optional(),
  outcome: z.enum(['ok', 'exception', 'canceled', 'exceededCpu', 'exceededMemory', 'unknown']).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(1000)).optional().default('100'),
  offset: z.string().transform(Number).pipe(z.number().int().min(0)).optional().default('0'),
  since: z.string().optional(), // ISO timestamp
});

/**
 * GET /api/logs
 * Get filtered worker logs
 */
logsRouter.get(
  '/',
  zValidator('query', getLogsSchema),
  async (c) => {
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
  }
);

/**
 * GET /api/logs/workers
 * Get list of unique worker names
 */
logsRouter.get('/workers', async (c) => {
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
logsRouter.get('/stats', async (c) => {
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
logsRouter.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
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
    logs: log[0].logs ? JSON.parse(log[0].logs) : null,
    exceptions: log[0].exceptions ? JSON.parse(log[0].exceptions) : null,
  };

  return c.json({ log: parsedLog });
});

export { logsRouter };
