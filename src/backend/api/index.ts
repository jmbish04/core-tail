/**
 * @fileoverview Main Hono API router
 *
 * This file sets up the main Hono application with all API routes and middleware.
 */
import type { D1Database, Ai } from "@cloudflare/workers-types";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { authMiddleware } from "./middleware/auth";
import { aiRouter } from "./routes/ai";
import { analysisRouter } from "./routes/analysis";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { documentsRouter } from "./routes/documents";
import { healthRouter } from "./routes/health";
import { logsRouter } from "./routes/logs";
import { notificationsRouter } from "./routes/notifications";
import { openapiApp } from "./routes/openapi";
import { streamRouter } from "./routes/stream";
import { threadsRouter } from "./routes/threads";

export type Bindings = {
  DB: D1Database;
  AI: Ai;
  AI_GATEWAY_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  WEBHOOK_SECRET?: string;
  GEMINI_API_KEY?: string;
  LOG_ANALYZER_AGENT: any; // DurableObjectNamespace
  LOG_STREAMER: any; // DurableObjectNamespace for WebSocket broadcasting
  ASSETS: any;
};

export type Variables = {
  userId?: number;
  user?: {
    id: number;
    email: string;
    name: string;
  };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/api/ping", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// Mount routers
app.route("/api/auth", authRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/threads", threadsRouter);
app.route("/api/health", healthRouter);
app.route("/api/notifications", notificationsRouter);
app.route("/api/ai", aiRouter);
app.route("/api/documents", documentsRouter);

// Protected routes
app.use("/api/logs/*", authMiddleware);
app.route("/api/logs", logsRouter);
app.use("/api/analysis/*", authMiddleware);
app.route("/api/analysis", analysisRouter);
app.route("/api/stream", streamRouter);

app.route("/", openapiApp);

export { app };
