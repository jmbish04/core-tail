# Implement Tail Worker and Agentic Log Analyzer

**Objective:** Build a centralized Tail Worker aggregator, a Shadcn-powered admin dashboard, and an error-analyzing Agent on the Cloudflare ecosystem.

## Observability and Connectivity Workflow

1. **Environment Audit**: Run `pnpm run build` and check the `dist` directory to confirm if `_worker.js` is a file or directory.
2. **KV Configuration**: Update `wrangler.jsonc` with the `RAW_LOGS` KV namespace binding and correct the `main` entry point path.
3. **Log Ingestion Update**: Modify `src/backend/services/tailHandler.ts` to implement the dual-write pattern (KV raw store + D1 indexed store) wrapped in `ctx.waitUntil`.
4. **Health Route Refactor**: Update `src/backend/api/routes/health.ts` to include parity checks and DO status verification.
5. **DO Export Validation**: Run `node build-worker.js` and verify the output bundle contains `export { LogStreamer }`.
6. **Deployment**: Run `pnpm run deploy` without log redirection to verify a clean production push.

## General Implementation Steps

1. **Analyze Requirements**: Review the requested feature and identify necessary schema, API, or UI changes.
2. **Schema Modifications**: If `src/backend/db/schema.ts` is modified, immediately run `npm run db:generate` locally to generate migration files.
3. **Commit Migrations**: ALWAYS commit the resulting `drizzle/*.sql` migration files and `drizzle/meta/` state updates to version control before any deployment.
4. **Clean Build Environment**: Run `rm -rf dist .astro node_modules/.vite` before any deployment to ensure no stale template assets remain.
5. **Verify Project Identity**: Ensure `package.json` metadata (name, author, repository), `wrangler.jsonc` name field, and `astro.config.ts` site URL are set to `core-tail` project values, not template values.
6. Initialize the Astro + React application and configure Hono for backend routing.
7. Configure Drizzle ORM with D1, defining the required schema and applying indexes appropriately.
8. Implement the `tail` export in `src/_worker.ts` to ingest cross-worker trace events into D1.
9. Scaffold OpenAPI v3.1.0 compliant Hono API routes for log retrieval, aggregation, and triggering the analysis agent.
10. Implement the single-user authentication middleware requiring only `WEBHOOK_SECRET`.
11. Build the Shadcn React frontend, including the Data Table, filtering dropdowns, and Recharts error aggregation dashboard.
12. Implement the Durable Object Agent using the Cloudflare Agents SDK.
13. Integrate Cloudflare API fetch logic within the Agent to retrieve target worker source code dynamically.
14. Connect the `cloudflare-docs` MCP tool to the Agent to analyze code and generate fix prompts.
15. Ensure all AI requests route through AI Gateway with the configured `gpt-oss-120b` fallback in compatibility mode.
16. **Code Generation & Validation**: Implement the requested changes across the Cloudflare Workers backend and Astro/React frontend using Shadcn UI.
17. **Validation**: Run `npm run check` and `wrangler types` to ensure type safety.
18. **Deploy Readiness**: Ensure deployment pipelines only apply existing migrations (`wrangler d1 migrations apply`) and do not generate them dynamically.
19. **Deploy with Clean Build**: Execute `npm run deploy` which will trigger `prebuild` cleanup, apply committed migrations, then deploy. Verify the uploaded asset manifest in terminal output to confirm new assets are deployed.
