# Implement Tail Worker and Agentic Log Analyzer

**Objective:** Build a centralized Tail Worker aggregator, a Shadcn-powered admin dashboard, and an error-analyzing Agent on the Cloudflare ecosystem.

**Steps:**

1. Initialize the Astro + React application and configure Hono for backend routing.
2. Configure Drizzle ORM with D1, defining the `logs` schema and applying indexes to `worker_name`.
3. Implement the `tail` export in `src/_worker.ts` to ingest cross-worker trace events into D1.
4. Scaffold OpenAPI v3.1.0 compliant Hono API routes for log retrieval, aggregation, and triggering the analysis agent.
5. Implement the single-user authentication middleware requiring only `WEBHOOK_SECRET`.
6. Build the Shadcn React frontend, including the Data Table, filtering dropdowns, and Recharts error aggregation dashboard.
7. Implement the Durable Object Agent using the Cloudflare Agents SDK.
8. Integrate Cloudflare API fetch logic within the Agent to retrieve target worker source code dynamically.
9. Connect the `cloudflare-docs` MCP tool to the Agent to analyze code and generate fix prompts.
10. Ensure all AI requests route through AI Gateway with the configured `gpt-oss-120b` fallback in compatibility mode.
