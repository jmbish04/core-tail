/**
 * @fileoverview Health check utilities for the LogAnalyzerAgent.
 *
 * Reports readiness of all upstream dependencies (SDK credentials,
 * Workers AI binding, D1, etc.) so the agent can fail fast with
 * clear diagnostics instead of opaque runtime errors.
 */

import { checkBrowserRenderHealth } from "@/backend/agent/methods/cloudflare/browser-render/health";

export type HealthStatus = {
  healthy: boolean;
  checks: Record<string, { ok: boolean; detail?: string; latencyMs?: number }>;
  timestamp: string;
};

/**
 * Run a full health check against all agent dependencies.
 */
export async function checkAgentHealth(env: Env): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = {};

  // 1. Cloudflare SDK credentials
  checks.cloudflareCredentials = {
    ok: Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_WRANGLER_API_TOKEN),
    detail: !env.CLOUDFLARE_ACCOUNT_ID
      ? "Missing CLOUDFLARE_ACCOUNT_ID"
      : !env.CLOUDFLARE_WRANGLER_API_TOKEN
        ? "Missing CLOUDFLARE_WRANGLER_API_TOKEN"
        : "Credentials available",
  };

  // 2. Workers AI binding
  checks.workersAI = {
    ok: Boolean(env.AI),
    detail: env.AI ? "AI binding available" : "Missing AI binding",
  };

  // 3. D1 database binding
  checks.database = {
    ok: Boolean(env.DB),
    detail: env.DB ? "D1 binding available" : "Missing DB binding",
  };

  // 4. KV binding for raw logs
  checks.rawLogsKV = {
    ok: Boolean(env.RAW_LOGS),
    detail: env.RAW_LOGS ? "RAW_LOGS KV available" : "Missing RAW_LOGS KV binding",
  };

  // 5. Optional: Gemini API key for multi-provider fallback
  checks.geminiKey = {
    ok: Boolean(env.GEMINI_API_KEY),
    detail: env.GEMINI_API_KEY
      ? "Gemini API key available"
      : "Not configured (optional)",
  };

  // 6. Browser Rendering API
  checks.browserRender = await checkBrowserRenderHealth(env);

  const healthy = checks.cloudflareCredentials.ok && checks.workersAI.ok && checks.browserRender.ok;

  return {
    healthy,
    checks,
    timestamp: new Date().toISOString(),
  };
}
