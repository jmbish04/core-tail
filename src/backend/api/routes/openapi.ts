/**
 * @fileoverview Dynamic OpenAPI documentation routes using @hono/zod-openapi
 */

import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";

import type { Bindings } from "../index";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// Define schemas
const LogEntrySchema = z.object({
  id: z.number().int().openapi({ example: 1 }),
  workerName: z.string().openapi({ example: "my-worker" }),
  eventTimestamp: z.string().datetime().openapi({ example: "2024-04-01T12:00:00Z" }),
  outcome: z.enum(["ok", "exception", "canceled", "exceededCpu", "exceededMemory", "unknown"]),
  scriptName: z.string().nullable(),
  logs: z.array(z.any()).nullable(),
  exceptions: z.array(z.any()).nullable(),
  statusCode: z.number().int().nullable(),
  requestUrl: z.string().nullable(),
  requestMethod: z.string().nullable(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

// GET /api/logs - Get filtered worker logs
const getLogsRoute = createRoute({
  method: "get",
  path: "/api/logs",
  tags: ["Logs"],
  operationId: "getLogs",
  summary: "Get filtered worker logs",
  request: {
    query: z.object({
      workerName: z.string().optional().openapi({ description: "Filter by worker name" }),
      outcome: z
        .enum(["ok", "exception", "canceled", "exceededCpu", "exceededMemory", "unknown"])
        .optional()
        .openapi({ description: "Filter by outcome" }),
      limit: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(1).max(1000))
        .optional()
        .default(100)
        .openapi({ description: "Number of logs to return" }),
      offset: z
        .string()
        .transform(Number)
        .pipe(z.number().int().min(0))
        .optional()
        .default(0)
        .openapi({ description: "Number of logs to skip" }),
      since: z
        .string()
        .datetime()
        .optional()
        .openapi({ description: "Filter logs after this timestamp" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(LogEntrySchema),
            pagination: z.object({
              limit: z.number().int(),
              offset: z.number().int(),
              total: z.number().int(),
            }),
          }),
        },
      },
      description: "Logs retrieved successfully",
    },
  },
});

// GET /api/logs/workers - Get list of unique worker names
const getWorkersListRoute = createRoute({
  method: "get",
  path: "/api/logs/workers",
  tags: ["Logs"],
  operationId: "getWorkersList",
  summary: "Get list of unique worker names",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            workers: z.array(z.string()),
          }),
        },
      },
      description: "Workers list retrieved successfully",
    },
  },
});

// GET /api/logs/stats - Get error rate statistics
const getLogsStatsRoute = createRoute({
  method: "get",
  path: "/api/logs/stats",
  tags: ["Logs"],
  operationId: "getLogsStats",
  summary: "Get error rate statistics",
  request: {
    query: z.object({
      workerName: z.string().optional().openapi({ description: "Filter stats by worker name" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            overview: z.object({
              totalLogs: z.number().int(),
              errorCount: z.number().int(),
              errorRate: z.number(),
            }),
            byOutcome: z.array(
              z.object({
                outcome: z.string(),
                count: z.number().int(),
              }),
            ),
            byWorker: z.record(z.string(), z.record(z.string(), z.number())),
          }),
        },
      },
      description: "Statistics retrieved successfully",
    },
  },
});

// GET /api/logs/:id - Get a specific log entry by ID
const getLogByIdRoute = createRoute({
  method: "get",
  path: "/api/logs/{id}",
  tags: ["Logs"],
  operationId: "getLogById",
  summary: "Get a specific log entry by ID",
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/).transform(Number).openapi({ description: "Log entry ID" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            log: LogEntrySchema,
          }),
        },
      },
      description: "Log entry retrieved successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
      description: "Log not found",
    },
  },
});

// GET /openapi.json - Serve OpenAPI spec dynamically
app.doc("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "Centralized Worker Logging API",
    version: "1.0.0",
    description: "API for centralized logging of Cloudflare Workers using Tail Consumers",
  },
  servers: [
    {
      url: "/api",
      description: "API Server",
    },
  ],
});

// GET /swagger - Swagger UI
app.get("/swagger", swaggerUI({ url: "/openapi.json" }));

// GET /scalar - Scalar UI
app.get(
  "/scalar",
  apiReference({
    spec: {
      url: "/openapi.json",
    },
    theme: "default",
  } as any),
);

// GET /docs - redirect to scalar
app.get("/docs", (c) => {
  return c.redirect("/scalar");
});

export { app as openapiApp, getLogsRoute, getWorkersListRoute, getLogsStatsRoute, getLogByIdRoute };
