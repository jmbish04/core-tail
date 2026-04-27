/**
 * @fileoverview OpenAPI documentation routes
 */

import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { apiReference } from '@scalar/hono-api-reference';
import type { Bindings } from '../index';

const openapiRouter = new Hono<{ Bindings: Bindings }>();

// OpenAPI specification
const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Core Template API',
    version: '1.0.0',
    description: 'API documentation for Cloudflare Workers AI powered application',
  },
  servers: [
    {
      url: '/api',
      description: 'API Server',
    },
  ],
  paths: {
    '/auth/login': {
      post: {
        operationId: 'loginUser',
        summary: 'User login',
        tags: ['Authentication'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    user: { type: 'object' },
                    token: { type: 'string' },
                    expiresAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/dashboard/metrics': {
      get: {
        operationId: 'getDashboardMetrics',
        summary: 'Get dashboard metrics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'category',
            in: 'query',
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100 },
          },
        ],
        responses: {
          '200': {
            description: 'Metrics retrieved successfully',
          },
        },
      },
    },
    '/threads': {
      get: {
        operationId: 'listThreads',
        summary: 'List user threads',
        tags: ['AI Threads'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Threads retrieved successfully',
          },
        },
      },
      post: {
        operationId: 'createThread',
        summary: 'Create a new thread',
        tags: ['AI Threads'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string', minLength: 1 },
                },
                required: ['title'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Thread created successfully',
          },
        },
      },
    },
    '/health': {
      get: {
        operationId: 'getHealth',
        summary: 'System health check',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'System is healthy',
          },
        },
      },
    },
    '/logs': {
      get: {
        operationId: 'getLogs',
        summary: 'Get filtered worker logs',
        tags: ['Logs'],
        parameters: [
          {
            name: 'workerName',
            in: 'query',
            schema: { type: 'string' },
            description: 'Filter by worker name',
          },
          {
            name: 'outcome',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['ok', 'exception', 'canceled', 'exceededCpu', 'exceededMemory', 'unknown'],
            },
            description: 'Filter by outcome',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100, minimum: 1, maximum: 1000 },
            description: 'Number of logs to return',
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', default: 0, minimum: 0 },
            description: 'Number of logs to skip',
          },
          {
            name: 'since',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            description: 'Filter logs after this timestamp',
          },
        ],
        responses: {
          '200': {
            description: 'Logs retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    logs: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          workerName: { type: 'string' },
                          eventTimestamp: { type: 'string', format: 'date-time' },
                          outcome: { type: 'string' },
                          scriptName: { type: 'string', nullable: true },
                          logs: { type: 'array', nullable: true },
                          exceptions: { type: 'array', nullable: true },
                          statusCode: { type: 'integer', nullable: true },
                          requestUrl: { type: 'string', nullable: true },
                          requestMethod: { type: 'string', nullable: true },
                        },
                      },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        limit: { type: 'integer' },
                        offset: { type: 'integer' },
                        total: { type: 'integer' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/logs/workers': {
      get: {
        operationId: 'getWorkersList',
        summary: 'Get list of unique worker names',
        tags: ['Logs'],
        responses: {
          '200': {
            description: 'Workers list retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    workers: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/logs/stats': {
      get: {
        operationId: 'getLogsStats',
        summary: 'Get error rate statistics',
        tags: ['Logs'],
        responses: {
          '200': {
            description: 'Statistics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    overview: {
                      type: 'object',
                      properties: {
                        totalLogs: { type: 'integer' },
                        errorCount: { type: 'integer' },
                        errorRate: { type: 'number' },
                      },
                    },
                    byOutcome: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          outcome: { type: 'string' },
                          count: { type: 'integer' },
                        },
                      },
                    },
                    byWorker: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/logs/{id}': {
      get: {
        operationId: 'getLogById',
        summary: 'Get a specific log entry by ID',
        tags: ['Logs'],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'Log entry ID',
          },
        ],
        responses: {
          '200': {
            description: 'Log entry retrieved successfully',
          },
          '404': {
            description: 'Log not found',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
      },
    },
  },
};

// GET /openapi.json
openapiRouter.get('/openapi.json', (c) => {
  return c.json(openApiSpec);
});

// GET /swagger
openapiRouter.get('/swagger', swaggerUI({ url: '/openapi.json' }));

// GET /scalar
openapiRouter.get(
  '/scalar',
  apiReference({
    spec: {
      url: '/openapi.json',
    },
    theme: 'dark',
  })
);

// GET /docs - redirect to scalar
openapiRouter.get('/docs', (c) => {
  return c.redirect('/scalar');
});

export { openapiRouter };
