/**
 * @fileoverview LogStreamer Durable Object for WebSocket log broadcasting
 *
 * This Durable Object manages WebSocket connections for real-time log streaming.
 * It uses the Hibernation API for efficient connection management.
 */

import { DurableObject } from "cloudflare:workers";

export class LogStreamer extends DurableObject {
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
  }

  /**
   * Handle incoming requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === "/health") {
      const sockets = this.ctx.getWebSockets();
      return new Response(
        JSON.stringify({
          status: "healthy",
          activeConnections: sockets.length,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // WebSocket Upgrade endpoint
    if (url.pathname === "/ws") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (upgradeHeader !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Use Hibernation API for efficient WebSocket management
      this.ctx.acceptWebSocket(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Ingest logs from the Tail Handler
    if (request.method === "POST" && url.pathname === "/ingest") {
      const logData = await request.text();
      this.broadcast(logData);
      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcast(message: string) {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch (e) {
        // Connection might be closed - Hibernation API will handle cleanup
        console.error("Error broadcasting to WebSocket:", e);
      }
    }
  }

  /**
   * Handle incoming messages from WebSocket clients
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : null;

      if (data && data.type === "subscribe") {
        // Send acknowledgment for subscription filter updates
        ws.send(
          JSON.stringify({
            type: "subscription_updated",
            filters: data.filters,
          }),
        );
      }
    } catch (e) {
      console.error("Error handling WebSocket message:", e);
    }
  }

  /**
   * Handle WebSocket close events
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // Hibernation API handles cleanup automatically
    ws.close(code, reason);
  }

  /**
   * Handle WebSocket error events
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error("WebSocket error:", error);
  }
}
