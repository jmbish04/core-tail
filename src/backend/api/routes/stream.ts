/**
 * @fileoverview WebSocket API for real-time log streaming using Durable Objects
 */

import { Hono } from "hono";
import type { Bindings } from "../index";

const streamRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/stream/logs
 * WebSocket endpoint for real-time log streaming via LogStreamer Durable Object
 * Query params: workerName, level, keyword (for client-side filtering)
 */
streamRouter.get("/logs", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  if (!c.env.LOG_STREAMER) {
    return c.text("LOG_STREAMER binding not configured", 500);
  }

  try {
    // Get the global LogStreamer Durable Object instance
    const doId = c.env.LOG_STREAMER.idFromName("global-streamer");
    const streamer = c.env.LOG_STREAMER.get(doId);

    // Forward the WebSocket upgrade request to the Durable Object
    return streamer.fetch("http://do/ws", c.req.raw);
  } catch (error) {
    console.error("Error connecting to LogStreamer DO:", error);
    return c.text("Failed to establish WebSocket connection", 500);
  }
});

export { streamRouter };
