# Agent Guidelines for Core-Tail Development

## UI/UX Standards

### No Browser Alerts Policy

**CRITICAL RULE:** It is **NEVER** acceptable to use browser `alert()`, `confirm()`, or `prompt()` dialogs in this codebase.

**Why:** Browser alerts:
- Block the entire UI and JavaScript execution
- Cannot be styled to match the application theme
- Provide poor user experience
- Are not accessible
- Look unprofessional

**Instead, ALWAYS use shadcn/ui components:**

1. **For notifications and feedback:** Use the custom Toast component (`src/frontend/components/ui/toast.tsx`)
   ```tsx
   import { useToast } from "./ui/toast";

   const { addToast } = useToast();

   addToast({
     title: "Success!",
     description: "Operation completed successfully",
     variant: "success",
     duration: 3000,
   });
   ```

2. **For confirmations:** Use AlertDialog component (`src/frontend/components/ui/alert-dialog.tsx`)
   ```tsx
   import {
     AlertDialog,
     AlertDialogAction,
     AlertDialogCancel,
     AlertDialogContent,
     AlertDialogDescription,
     AlertDialogFooter,
     AlertDialogHeader,
     AlertDialogTitle,
   } from "./ui/alert-dialog";
   ```

3. **For input prompts:** Use Dialog or Popover components with Input fields

### Toast Variants

The Toast component supports these variants:
- `success`: Green, for successful operations
- `error`: Red, for errors and failures
- `warning`: Yellow, for warnings
- `info`: Blue, for informational messages
- `default`: Standard theme colors

### Copy to Clipboard Pattern

Always provide user feedback when copying to clipboard:

```tsx
const handleCopy = () => {
  navigator.clipboard
    .writeText(content)
    .then(() => {
      addToast({
        title: "Copied!",
        description: "Content copied to clipboard",
        variant: "success",
        duration: 2000,
      });
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      addToast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "error",
        duration: 3000,
      });
    });
};
```

## Development Best Practices

### Component Structure
- Use TypeScript for all React components
- Follow the existing shadcn/ui patterns
- Maintain consistent styling with Tailwind CSS
- Use lucide-react for icons

### Error Handling (MANDATORY)

> **Full specification:** See `.agent/rules/frontend-error-handling.md`

**All errors MUST use BOTH:**
1. `console.error("[ComponentName] context:", err)` — for developer console
2. `logger.error("Title", err, "context")` — for user-facing toast via `FrontendLogger`

```tsx
import { logger } from "@/lib/logger";

// ❌ FORBIDDEN — empty catch
} catch (e) {}

// ❌ FORBIDDEN — console-only, no user feedback
} catch (e) { console.error(e); }

// ✅ CORRECT — both console + logger
} catch (err) {
  console.error("[MyComponent] Failed:", err);
  logger.error("Load Failed", err, "## Context\n\nError details for agent");
}
```

**All API fetch calls MUST use `apiFetch` from `@/lib/api`:**
```tsx
import { apiFetch } from "@/lib/api";

// ❌ WRONG — raw fetch crashes on non-JSON responses
const res = await fetch("/api/logs/stats");
const data = await res.json();

// ✅ CORRECT — safe parsing
const { ok, status, data } = await apiFetch("/api/logs/stats");
```

### Accessibility
- Include proper ARIA labels
- Ensure keyboard navigation works
- Maintain proper focus management
- Use semantic HTML elements

## Code Review Checklist

Before submitting code, verify:
- [ ] No usage of `alert()`, `confirm()`, or `prompt()`
- [ ] No empty `catch` blocks — every catch has `console.error` + `logger`
- [ ] All API calls use `apiFetch` from `@/lib/api`
- [ ] All user feedback uses `logger` (success, error, info, warning)
- [ ] All clipboard operations have `.catch()` handlers with `logger.error`
- [ ] TypeScript types are properly defined
- [ ] Components are accessible
- [ ] Styling is consistent with the design system
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
