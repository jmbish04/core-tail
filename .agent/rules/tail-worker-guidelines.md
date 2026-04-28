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

## WebSocket Resiliency & Fallbacks

17. **Mandatory Polling Fallback**: Any frontend interface relying on Cloudflare Durable Object WebSockets for real-time data must implement a degraded polling fallback. If the WebSocket connection closes (e.g., due to hibernation timeout, network drop, or strict proxy firewalls), the client must automatically initiate a REST polling loop against a synchronous fallback API (e.g., D1 database fetch) while attempting exponential backoff reconnections.
18. **Log Mirroring**: Workers acting as telemetry or tail processors must mirror their own internal logs. These logs should be written to D1 and simultaneously dispatched to the WebSocket broadcasting DO to ensure the frontend reflects both historical and real-time states accurately.
19. **Sync Fallback Endpoint**: Provide a synchronous REST API endpoint (e.g., `GET /api/logs/sync`) that returns recent log entries from persistent storage (D1 database). This endpoint should support:
    - `limit` parameter to control the number of entries returned
    - `since` parameter for incremental synchronization (ISO timestamp)
    - Structured response with logs array, timestamp, and count
20. **Automatic Degradation**: Frontend WebSocket clients should automatically detect connection failures (`onclose`, `onerror` events) and immediately fall back to polling mode without user intervention. The polling interval should be reasonable (3-5 seconds) to balance freshness with resource usage.
21. **Visual Indicators**: The UI must clearly indicate the connection state:
    - Connected: Real-time WebSocket streaming active
    - Polling Mode: Fallback polling with refresh interval
    - Disconnected: No connectivity, manual refresh required
22. **State Persistence**: During WebSocket-to-polling transitions, maintain log state continuity by tracking the last synchronized timestamp to avoid duplicate entries when reconnecting.

## Frontend Component Guidelines

23. **Complete Fallback Coverage**: When rendering realtime connections via WebSockets in Shadcn components, fallback configurations (e.g., `setInterval` fetching against `/api/logs/sync`) must be fully implemented and integrated with the state variables `isPolling`, `isReconnecting`, and `isConnected`.
24. **Complete Component Rendering**: Never truncate UI returns or elements utilizing `<Select>` or `<Card>` blocks from Shadcn in code generation tasks. The full tree, including child item iterators, must be output to avoid broken local states.
25. **Full Code Delivery**: Always respond with complete, end-to-end code. Never use shortcuts like `// ... rest of code` or truncate component implementations. Every file modification must include the entire file content to ensure no partial implementations remain.
