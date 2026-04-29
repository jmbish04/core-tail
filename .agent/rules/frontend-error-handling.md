# Frontend Error Handling & Logging Rules

> **MANDATORY** — All agents must follow these rules without exception when working on frontend code.

## 1. Global Logger is Required

All user-facing feedback (errors, success, warnings, info) **MUST** go through the `FrontendLogger` singleton at `src/frontend/lib/logger.ts`.

```tsx
import { logger } from "@/lib/logger";

// Errors: always logger + console
logger.error("Title", error, "## Context\n\nMarkdown prompt for agent");
console.error("[ComponentName] description:", error);

// Success
logger.success("Title", "Description");

// Info / Warning
logger.info("Title", "Description");
logger.warning("Title", "Description");
```

## 2. Browser Alerts are Banned

**NEVER** use `window.alert()`, `window.confirm()`, or `window.prompt()`.

- ❌ `alert("Success!")` — **FORBIDDEN**
- ❌ `confirm("Are you sure?")` — **FORBIDDEN**
- ❌ `prompt("Enter value")` — **FORBIDDEN**
- ✅ `logger.success("Success!", "Operation completed")` — **CORRECT**
- ✅ Use `AlertDialog` from shadcn for confirmations — **CORRECT**

## 3. Empty Catch Blocks are Banned

Patterns like `} catch (e) {}` or `} catch {}` are **NEVER** acceptable.

Every catch block must at minimum:
1. `console.error("[ComponentName] context:", error)` — for developer console
2. `logger.error("Title", error, "context")` — for user-facing toast

```tsx
// ❌ WRONG
try { ... } catch (e) {}
try { ... } catch {}

// ✅ CORRECT
try {
  // ...
} catch (err) {
  console.error("[MyComponent] Failed to load data:", err);
  logger.error("Load Failed", err, "## Context\n\nFailed to load data from /api/...");
}
```

## 4. Safe API Fetching

All frontend `fetch()` calls to `/api/*` endpoints **MUST** use the centralized `apiFetch` utility at `src/frontend/lib/api.ts`.

```tsx
import { apiFetch } from "@/lib/api";

// ❌ WRONG - raw fetch + res.json() crashes on non-JSON responses
const res = await fetch("/api/logs/stats");
const data = await res.json(); // 💥 SyntaxError if response is HTML or malformed

// ✅ CORRECT - safe parsing with descriptive error messages
const { ok, status, data } = await apiFetch("/api/logs/stats");
if (!ok) {
  logger.error("Failed", data.error, `## API Error\n\n**Status:** ${status}`);
}
```

**Why:** The `apiFetch` utility:
- Parses response as text first, then JSON, preventing `SyntaxError` crashes
- Provides descriptive error messages including the raw response when parsing fails
- Works with the BaseLayout fetch interceptor for automatic auth header injection

## 5. Clipboard Copy Pattern

Always provide user feedback when copying to clipboard:

```tsx
navigator.clipboard.writeText(content)
  .then(() => {
    logger.success("Copied!", "Content copied to clipboard");
  })
  .catch((err) => {
    console.error("[ComponentName] Copy failed:", err);
    logger.error("Copy Failed", err, "Failed to copy to clipboard");
  });
```

## 6. Summary Checklist

Before submitting frontend code, verify:
- [ ] No usage of `alert()`, `confirm()`, or `prompt()`
- [ ] No empty `catch` blocks
- [ ] All API calls use `apiFetch` from `@/lib/api`
- [ ] All errors use both `console.error` AND `logger.error`
- [ ] All success feedback uses `logger.success`
- [ ] All clipboard operations have `.catch()` handlers
