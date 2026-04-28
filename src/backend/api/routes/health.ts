/**
 * @fileoverview Health monitoring API routes
 */

import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import type { Bindings } from "../index";

import { healthChecks, workerLogs } from "../../db/schema";

const healthRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Check log parity between RAW_LOGS KV and D1 worker_logs table
 */
async function checkLogParity(env: Bindings): Promise<{
  status: string;
  kvCount: number;
  dbCount: number;
  parity: boolean;
  message: string;
}> {
  try {
    if (!env.RAW_LOGS) {
      return {
        status: "warning",
        kvCount: 0,
        dbCount: 0,
        parity: false,
        message: "RAW_LOGS KV namespace not configured",
      };
    }

    // Get last 10 keys from RAW_LOGS KV
    const kvList = await env.RAW_LOGS.list({ prefix: "raw:", limit: 10 });
    const kvCount = kvList.keys.length;

    // Check if corresponding records exist in D1
    const db = drizzle(env.DB);
    const recentLogs = await db
      .select()
      .from(workerLogs)
      .orderBy(desc(workerLogs.eventTimestamp))
      .limit(10);

    const dbCount = recentLogs.length;

    // Calculate parity (allow some variance due to async processing)
    const parity = Math.abs(kvCount - dbCount) <= 2;

    return {
      status: parity ? "healthy" : "degraded",
      kvCount,
      dbCount,
      parity,
      message: parity
        ? "Log parity is healthy"
        : `Log parity mismatch: KV has ${kvCount}, D1 has ${dbCount}`,
    };
  } catch (error) {
    return {
      status: "error",
      kvCount: 0,
      dbCount: 0,
      parity: false,
      message: `Parity check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check WebSocket/Durable Object health
 */
async function checkWebSocketStatus(env: Bindings): Promise<{
  status: string;
  message: string;
  doReachable: boolean;
}> {
  try {
    if (!env.LOG_STREAMER) {
      return {
        status: "error",
        message: "LOG_STREAMER binding not configured",
        doReachable: false,
      };
    }

    const doId = env.LOG_STREAMER.idFromName("global-streamer");
    const streamer = env.LOG_STREAMER.get(doId);

    // Perform internal health check on the DO
    const response = await streamer.fetch("http://do/health");

    if (response.ok) {
      return {
        status: "healthy",
        message: "LogStreamer DO is active and responding",
        doReachable: true,
      };
    } else {
      return {
        status: "degraded",
        message: `LogStreamer DO returned status ${response.status}`,
        doReachable: true,
      };
    }
  } catch (error) {
    return {
      status: "error",
      message: `WebSocket check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      doReachable: false,
    };
  }
}

// GET /api/health
healthRouter.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const startTime = Date.now();

  try {
    // Test database connection
    await db.select().from(healthChecks).limit(1);
    const dbResponseTime = Date.now() - startTime;

    // Run diagnostics in parallel
    const [logParity, websocketStatus] = await Promise.all([
      checkLogParity(c.env),
      checkWebSocketStatus(c.env),
    ]);

    // Get latest health check for each service
    const allChecks = await db
      .select()
      .from(healthChecks)
      .orderBy(desc(healthChecks.timestamp))
      .limit(100);

    const latestChecks = allChecks.reduce(
      (acc, check) => {
        if (!acc[check.serviceName]) {
          acc[check.serviceName] = check;
        }
        return acc;
      },
      {} as Record<string, (typeof allChecks)[0]>,
    );

    // Determine overall status
    const statuses = Object.values(latestChecks).map((c) => c.status);
    let overallStatus = "healthy";

    // Factor in diagnostic statuses
    if (logParity.status === "error" || websocketStatus.status === "error") {
      overallStatus = "down";
    } else if (statuses.includes("down")) {
      overallStatus = "down";
    } else if (
      statuses.includes("degraded") ||
      logParity.status === "degraded" ||
      websocketStatus.status === "degraded"
    ) {
      overallStatus = "degraded";
    }

    // Record this health check
    await db.insert(healthChecks).values({
      serviceName: "api",
      status: "healthy",
      responseTime: dbResponseTime,
      timestamp: new Date(),
    });

    return c.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: latestChecks,
      responseTime: Date.now() - startTime,
      diagnostics: {
        logParity,
        websocketStatus,
      },
    });
  } catch (error) {
    console.error("Health check error:", error);
    return c.json(
      {
        status: "down",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      },
      503,
    );
  }
});

// GET /api/health/history
healthRouter.get("/history", async (c) => {
  const db = drizzle(c.env.DB);
  const service = c.req.query("service");
  const limit = parseInt(c.req.query("limit") || "100");

  try {
    let query = db.select().from(healthChecks);

    if (service) {
      query = query.where(eq(healthChecks.serviceName, service));
    }

    const history = await query.orderBy(desc(healthChecks.timestamp)).limit(limit);

    return c.json({ history });
  } catch (error) {
    console.error("Error fetching health history:", error);
    return c.json({ error: "Failed to fetch health history" }, 500);
  }
});

export { healthRouter };
