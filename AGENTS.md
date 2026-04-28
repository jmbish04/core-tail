# Log Analyzer Agent Configuration

This project utilizes the [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/) to provide stateful, AI-powered log analysis. The core logic resides in the `LogAnalyzerAgent` Durable Object.

## Overview

The `LogAnalyzerAgent` is responsible for triaging errors captured by the tail worker. When triggered, it:
1.  **Retrieves Context**: Fetches the original source code of the failing worker using the Cloudflare API.
2.  **Analyzes with AI**: Sends the error message, metadata, and source code to Workers AI for deep analysis.
3.  **Generates Fixes**: Returns a detailed analysis and a ready-to-copy prompt containing the full end-to-end code to fix the error.

## Agent Definition: `LogAnalyzerAgent`

### State Schema
The agent maintains a persistent state to track the progress of log analysis.

```typescript
type AgentState = {
  analysis: string | null;
  status: "idle" | "analyzing" | "complete" | "error";
};
```

### Endpoints

#### `POST /analyze`
Triggers the AI analysis workflow for a specific log entry.

**Request Body:**
```json
{
  "workerName": "string",
  "logId": 123,
  "message": "string",
  "metadata": "string | null"
}
```

**Logic Flow:**
* Sets status to `analyzing`.
* (Optional) Fetches source code from `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/scripts/${workerName}`.
* Invokes Workers AI model `@cf/openai/gpt-oss-120b` with a specialized prompt requiring full end-to-end code output.
* Updates state with the resulting analysis and sets status to `complete`.

## Configuration

### `wrangler.jsonc`
The agent must be registered as a Durable Object with an appropriate migration.

```json
{
  "durable_objects": {
    "bindings": [
      { "name": "LOG_ANALYZER_AGENT", "class_name": "LogAnalyzerAgent" }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["LogAnalyzerAgent"]
    }
  ]
}
```

### Environment Variables
For the agent to successfully retrieve source code and perform AI inference, the following bindings and secrets are required:

* `AI`: Cloudflare Workers AI binding.
* `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.
* `CLOUDFLARE_API_TOKEN`: A token with permissions to read Worker scripts.
* `GEMINI_API_KEY`: (Optional) For multi-provider fallback.

## Usage Pattern

The agent is typically accessed through the Hono API router in `src/backend/api/routes/ai.ts`.

```typescript
// Example: Accessing the agent via the binding
const id = env.LOG_ANALYZER_AGENT.idFromName(workerName);
const agent = env.LOG_ANALYZER_AGENT.get(id);
const response = await agent.fetch("http://agent/analyze", {
  method: "POST",
  body: JSON.stringify({ workerName, logId, message, metadata })
});
```

## Development Best Practices
* **WaitUntil**: Always wrap D1 insertions and agent communications in `ctx.waitUntil()` within the tail handler to prevent premature worker termination.
* **Hibernation**: This agent uses the standard `Agent` class which supports efficient Durable Object hibernation.
* **Complete Code Output**: The agent is strictly configured to never skip code blocks or use shortcuts like `// rest of code`.
