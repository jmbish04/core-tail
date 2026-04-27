# Tail Worker & Agent Execution Rules

INSTRUCTION: Review the existing `.agent/rules/` directory first, and then merge/update the existing rule files with the new content provided below. Do not create new rule files unless a fundamentally new category is being introduced.

1. **Dual Ingestion**: The core worker must handle a standard Hono `fetch` pipeline while concurrently processing events via the Cloudflare `tail` pipeline.
2. **Dynamic Code Retrieval**: The Agents SDK implementation must fetch the raw worker source code via the Cloudflare REST API when triggered to analyze an error.
3. **MCP Integration**: The Agent must strictly use the `cloudflare-docs` MCP server to cross-reference error traces and source code against official Cloudflare documentation.
4. **AI Gateway & Fallback**: Integrate using the `GEMINI_API_KEY`. The fallback must exclusively use `workers-ai/@cf/openai/gpt-oss-120b` configured in AI Gateway compatibility mode.
5. **Non-Interactive Execution**: The analysis agent must execute linearly upon request. The frontend passes the error and worker context, and the agent returns a finalized, copy-paste ready fix prompt without invoking a continuous chat loop.
6. **Authentication Validation**: Admin endpoints are secured using only the `WEBHOOK_SECRET` as the password, mapping to the pre-approved `allowed_email`.
