/**
 * @fileoverview Health check for the Cloudflare Browser Rendering module.
 *
 * Validates credentials and verifies that the Browser Rendering API is
 * reachable and responding via the Cloudflare SDK.
 */

import Cloudflare from "cloudflare";
import { getSecret } from "@/backend/utils/secrets";

export type BrowserRenderHealth = {
  ok: boolean;
  detail: string;
  latencyMs?: number;
};

export async function checkBrowserRenderHealth(env: Env): Promise<BrowserRenderHealth> {
  const start = Date.now();

  try {
    const apiToken =
      (await getSecret(env, "CF_BROWSER_RENDER_TOKEN")) ||
      (await getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN"));
    const accountId = await getSecret(env, "CLOUDFLARE_ACCOUNT_ID");

    if (!apiToken || !accountId) {
      return {
        ok: false,
        detail: "Missing CF_BROWSER_RENDER_TOKEN or CLOUDFLARE_ACCOUNT_ID",
      };
    }

    const client = new Cloudflare({ apiToken });

    // Validate connectivity using a lightweight payload (a simple HTML string)
    // We expect a success result containing the markdown text.
    const result = await client.browserRendering.markdown.create({
      account_id: accountId,
      html: "<h1>Health Check</h1>",
    });

    const success = typeof result === "string" || (result as any)?.success !== false;

    if (!success) {
      return {
        ok: false,
        detail: `Browser Rendering API returned failure: ${JSON.stringify(result)}`,
        latencyMs: Date.now() - start,
      };
    }

    return {
      ok: true,
      detail: "Browser Rendering API is reachable",
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      detail: `Connection failed: ${message}`,
      latencyMs: Date.now() - start,
    };
  }
}
