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

    // CRITICAL FIX #1: Auto-reply to application-level pings without waking the DO.
    // Without this, frontend pings go unanswered during hibernation → frontend sees "disconnected".
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
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

    // Ingest logs from the Tail Handler
    if (request.method === "POST" && url.pathname === "/ingest") {
      const logData = await request.text();
      this.broadcast(logData);
      return new Response("OK");
    }

    // WebSocket Upgrade endpoint - accept any path with Upgrade: websocket header
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Use Hibernation API for efficient WebSocket management
      this.ctx.acceptWebSocket(server);

      // CRITICAL FIX #2: Persist per-connection state so it survives hibernation.
      // When the DO wakes up, the constructor re-runs and you can restore this via deserializeAttachment.
      server.serializeAttachment({
        connectedAt: Date.now(),
        filters: [] as string[],
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Broadcast message to all connected WebSocket clients
   */
  broadcast(message: string) {
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      // FIX #3: Only send to OPEN connections to avoid errors on CLOSING/CLOSED sockets
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (e) {
          console.error("Error broadcasting to WebSocket:", e);
        }
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
        // FIX #2 (continued): Update attachment when filters change so they survive hibernation
        const attachment = ws.deserializeAttachment() || {};
        ws.serializeAttachment({ ...attachment, filters: data.filters });

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
  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean) {
    // Hibernation API handles cleanup automatically
    ws.close(code, reason);
  }

  /**
   * Handle WebSocket error events
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error("WebSocket error:", error);
    // FIX #4: Close the socket on error to ensure cleanup
    ws.close(1011, "WebSocket error");
  }
}
