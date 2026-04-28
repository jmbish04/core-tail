# Implement Tail Worker and Agentic Log Analyzer

**Objective:** Build a centralized Tail Worker aggregator, a Shadcn-powered admin dashboard, and an error-analyzing Agent on the Cloudflare ecosystem.

**Steps:**

1. **Clean Build Environment**: Run `rm -rf dist .astro node_modules/.vite` before any deployment to ensure no stale template assets remain.
2. **Verify Project Identity**: Ensure `package.json` metadata (name, author, repository), `wrangler.jsonc` name field, and `astro.config.ts` site URL are set to `core-tail` project values, not template values.
3. Initialize the Astro + React application and configure Hono for backend routing.
4. Configure Drizzle ORM with D1, defining the `logs` schema and applying indexes to `worker_name`.
5. Implement the `tail` export in `src/_worker.ts` to ingest cross-worker trace events into D1.
6. Scaffold OpenAPI v3.1.0 compliant Hono API routes for log retrieval, aggregation, and triggering the analysis agent.
7. Implement the single-user authentication middleware requiring only `WEBHOOK_SECRET`.
8. Build the Shadcn React frontend, including the Data Table, filtering dropdowns, and Recharts error aggregation dashboard.
9. Implement the Durable Object Agent using the Cloudflare Agents SDK.
10. Integrate Cloudflare API fetch logic within the Agent to retrieve target worker source code dynamically.
11. Connect the `cloudflare-docs` MCP tool to the Agent to analyze code and generate fix prompts.
12. Ensure all AI requests route through AI Gateway with the configured `gpt-oss-120b` fallback in compatibility mode.
13. **Deploy with Clean Build**: Execute `pnpm run deploy` which will trigger `prebuild` cleanup, then verify the uploaded asset manifest in terminal output to confirm new assets are deployed.
