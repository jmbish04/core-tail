/**
 * @fileoverview Fetch worker script source code via the Cloudflare SDK.
 *
 * Replaces the previous raw `fetch()` call to the Cloudflare REST API with
 * the official `cloudflare` npm SDK for type-safe, retryable access.
 */

import Cloudflare from "cloudflare";
import type { WorkerScriptResult } from "@/backend/agent/types";
import { getSecret } from "@/backend/utils/secrets";

/**
 * Download the source code of a deployed Cloudflare Worker by name.
 *
 * Uses `client.workers.scripts.content.get()` which returns the raw script
 * content as a Response. For multi-file Workers, this returns the main
 * entry module.
 */
export async function fetchWorkerScript(
  env: Env,
  workerName: string,
): Promise<WorkerScriptResult> {
  const accountId = await getSecret(env, "CLOUDFLARE_ACCOUNT_ID");
  const apiToken = await getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN");

  if (!accountId || !apiToken) {
    return {
      success: false,
      content: "// Source code unavailable — missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_WRANGLER_API_TOKEN",
      error: "Missing credentials",
    };
  }

  try {
    const client = new Cloudflare({ apiToken });

    // Download the worker script content
    // SDK method: client.workers.scripts.content.get()
    const response = await client.workers.scripts.content.get(workerName, {
      account_id: accountId,
    });

    // The SDK returns a Response object for binary/text content endpoints
    if (response instanceof Response) {
      const content = await response.text();
      return { success: true, content };
    }

    // Fallback: if the SDK returns something unexpected, stringify it
    const content =
      typeof response === "string" ? response : JSON.stringify(response, null, 2);
    return { success: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Agent:Script] Failed to fetch script "${workerName}":`, message);

    return {
      success: false,
      content: `// Source code unavailable — SDK error: ${message}`,
      error: message,
    };
  }
}

/**
 * List all Worker scripts in the account.
 *
 * Useful for the agent to validate that a worker name actually exists
 * before attempting deeper analysis.
 */
export async function listWorkerScripts(
  env: Env,
): Promise<string[]> {
  const accountId = await getSecret(env, "CLOUDFLARE_ACCOUNT_ID");
  const apiToken = await getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN");

  if (!accountId || !apiToken) return [];

  try {
    const client = new Cloudflare({ apiToken });
    const scripts: string[] = [];

    for await (const script of client.workers.scripts.list({
      account_id: accountId,
    })) {
      if (script.id) scripts.push(script.id);
    }

    return scripts;
  } catch (error) {
    console.error("[Agent:Script] Failed to list worker scripts:", error);
    return [];
  }
}
