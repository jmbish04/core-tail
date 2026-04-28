# Tail Worker & Agent Execution Rules

INSTRUCTION: Review the existing `.agent/rules/` directory first, and then merge/update the existing rule files with the new content provided below. Do not create new rule files unless a fundamentally new category is being introduced.

1. **Dual Ingestion**: The core worker must handle a standard Hono `fetch` pipeline while concurrently processing events via the Cloudflare `tail` pipeline.
2. **Dynamic Code Retrieval**: The Agents SDK implementation must fetch the raw worker source code via the Cloudflare REST API when triggered to analyze an error.
3. **MCP Integration**: The Agent must strictly use the `cloudflare-docs` MCP server to cross-reference error traces and source code against official Cloudflare documentation.
4. **AI Gateway & Fallback**: Integrate using the `GEMINI_API_KEY`. The fallback must exclusively use `workers-ai/@cf/openai/gpt-oss-120b` configured in AI Gateway compatibility mode.
5. **Non-Interactive Execution**: The analysis agent must execute linearly upon request. The frontend passes the error and worker context, and the agent returns a finalized, copy-paste ready fix prompt without invoking a continuous chat loop.
6. **Authentication Validation**: Admin endpoints are secured using only the `WEBHOOK_SECRET` as the password, mapping to the pre-approved `allowed_email`.
7. **BUILD INTEGRITY**: Always include a `prebuild` script that runs `rm -rf dist .astro node_modules/.vite` to prevent asset "ghosting" from template deployments. This ensures no stale template artifacts persist between builds.
8. **IDENTITY ISOLATION**: When a project is cloned from a template, immediately verify that `package.json` metadata (name, description, author, repository URL), `wrangler.jsonc` names, and `astro.config.ts` site URLs are updated to reflect the new project identity, not the template's identity.
9. **ASSET MAPPING**: Ensure the `ASSETS` binding in `_worker.ts` is explicitly tested against the current `dist` directory contents after every major build change. The `env.ASSETS.fetch(request)` call must serve content from the newly built `dist` directory, not cached template assets.

## Enhanced Observability Rules

10. **Async Safety**: Every asynchronous operation within a `tail()` handler (D1 inserts, KV puts, DO fetches) **MUST** be wrapped in `ctx.waitUntil(promise)` to prevent the Worker isolate from being evicted before completion.
11. **Build Integrity**: When using Astro with the Cloudflare adapter, always use a post-build script (`build-worker.js`) to re-inject Durable Object exports that may be stripped by the Astro bundling process.
12. **Log Redundancy**: Implement a "Raw-to-Indexed" buffer using KV for incoming tail events to provide a recovery path and health diagnostic source if D1 indexing fails.
13. **Transparency**: Never mask deployment output in CI/CD environments; ensure `npx wrangler deploy` output is streamed directly to the terminal.
14. **Durable Object Exports**: Always ensure that Durable Object classes are properly exported in the final worker bundle. The build-worker.js script should detect and patch missing exports automatically.
15. **Health Monitoring**: Implement comprehensive health checks that verify:
    - Database connectivity and response times
    - Log parity between KV raw storage and D1 indexed storage
    - Durable Object reachability and WebSocket connectivity
    - Overall system status aggregation
16. **Error Handling**: All async operations should include proper error handling and logging. Errors should not cause the entire batch to fail; instead, log the error and continue processing remaining events.
