/**
 * @fileoverview WebSocket API for real-time log streaming
 */

import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { workerLogs } from "../../db/schema";
import { desc, eq, like, and, gte } from "drizzle-orm";
import type { Bindings } from "../index";

const streamRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/stream/logs
 * WebSocket endpoint for real-time log streaming
 * Query params: workerName, level, keyword
 */
streamRouter.get("/logs", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  const workerName = c.req.query("workerName");
  const level = c.req.query("level");
  const keyword = c.req.query("keyword");

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  // Accept the WebSocket connection
  server.accept();

  // Set up periodic log polling
  const intervalId = setInterval(async () => {
    try {
      const db = drizzle(c.env.DB);

      // Build filter conditions
      const conditions = [];

      if (workerName && workerName !== "all") {
        conditions.push(eq(workerLogs.workerName, workerName));
      }

      if (level && level !== "all") {
        // For level filtering, we need to check the logs JSON field
        // This is a simplified version - you might need more sophisticated filtering
        conditions.push(like(workerLogs.outcome, `%${level}%`));
      }

      // Get last 50 logs (adjust based on your needs)
      const lastChecked = new Date(Date.now() - 5000); // Last 5 seconds
      conditions.push(gte(workerLogs.eventTimestamp, lastChecked));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const logs = await db
        .select()
        .from(workerLogs)
        .where(whereClause)
        .orderBy(desc(workerLogs.eventTimestamp))
        .limit(50);

      // Filter by keyword if provided
      let filteredLogs = logs;
      if (keyword) {
        filteredLogs = logs.filter((log) => {
          const logText = JSON.stringify(log).toLowerCase();
          return logText.includes(keyword.toLowerCase());
        });
      }

      if (filteredLogs.length > 0) {
        server.send(
          JSON.stringify({
            type: "logs",
            data: filteredLogs.map((log) => ({
              ...log,
              eventTimestamp: log.eventTimestamp.toISOString(),
              logs: log.logs ? JSON.parse(log.logs) : null,
              exceptions: log.exceptions ? JSON.parse(log.exceptions) : null,
            })),
          })
        );
      }
    } catch (error) {
      console.error("Error streaming logs:", error);
      server.send(
        JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        })
      );
    }
  }, 2000); // Poll every 2 seconds

  // Handle WebSocket close
  server.addEventListener("close", () => {
    clearInterval(intervalId);
  });

  server.addEventListener("error", (event) => {
    console.error("WebSocket error:", event);
    clearInterval(intervalId);
  });

  // Send initial connection success message
  server.send(
    JSON.stringify({
      type: "connected",
      filters: { workerName, level, keyword },
    })
  );

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

export { streamRouter };
