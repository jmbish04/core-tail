/**
 * @fileoverview OpenAPI documentation routes
 */

import { swaggerUI } from "@hono/swagger-ui";
import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";

import type { Bindings } from "../index";

const openapiRouter = new Hono<{ Bindings: Bindings }>();

// OpenAPI specification
const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Core Template API",
    version: "1.0.0",
    description: "API documentation for Cloudflare Workers AI powered application",
  },
  servers: [
    {
      url: "/api",
      description: "API Server",
    },
  ],
  paths: {
    "/ping": {
      get: {
        summary: "Health check ping",
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    timestamp: { type: "number", example: 1709999999999 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "Detailed health check",
        responses: {
          "200": {
            description: "Successful response",
          },
        },
      },
    },
    "/logs": {
      get: {
        summary: "Get logs",
        responses: {
          "200": {
            description: "Successful response",
          },
        },
      },
    },
    "/logs/metrics": {
      get: {
        summary: "Get log metrics",
        responses: {
          "200": {
            description: "Successful response",
          },
        },
      },
    },
  },
};

// GET /openapi.json
openapiRouter.get("/openapi.json", (c) => c.json(openApiSpec));

// GET /swagger
openapiRouter.get("/swagger", swaggerUI({ url: "/openapi.json" }));

// GET /scalar
openapiRouter.get(
  "/scalar",
  apiReference({
    spec: {
      url: "/openapi.json",
    },
    theme: "default",
  } as any),
);

// GET /docs - redirect to scalar
openapiRouter.get("/docs", (c) => {
  return c.redirect("/scalar");
});

export { openapiRouter };
