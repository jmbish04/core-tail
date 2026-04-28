/**
 * @fileoverview Browser Rendering module for the LogAnalyzerAgent.
 *
 * Uses the Cloudflare Browser Rendering REST API via the official `cloudflare`
 * TypeScript SDK to convert URLs and raw HTML into clean markdown.
 *
 * Endpoints used:
 *   - POST /markdown  — convert URL or HTML to markdown
 *   - POST /content   — fetch raw HTML content
 *   - POST /links     — extract links from a page
 *
 * The agent uses `urlToMarkdown()` to convert Cloudflare docs pages into
 * token-efficient markdown for AI consumption.
 */

import Cloudflare from "cloudflare";
import { getSecret } from "@/backend/utils/secrets";

// ── Types ───────────────────────────────────────────────────────────────────

export type MarkdownResult = {
  success: boolean;
  markdown: string;
  url?: string;
  error?: string;
};

// ── Client ──────────────────────────────────────────────────────────────────

async function createClient(env: Env): Promise<{ client: Cloudflare; accountId: string }> {
  const apiToken =
    (await getSecret(env, "CF_BROWSER_RENDER_TOKEN")) ||
    (await getSecret(env, "CLOUDFLARE_WRANGLER_API_TOKEN"));
  const accountId = await getSecret(env, "CLOUDFLARE_ACCOUNT_ID");

  if (!apiToken || !accountId) {
    throw new Error("Missing Browser Rendering credentials (CF_BROWSER_RENDER_TOKEN + CLOUDFLARE_ACCOUNT_ID)");
  }

  return { client: new Cloudflare({ apiToken }), accountId };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert a URL to clean markdown via Browser Rendering `/markdown` endpoint.
 *
 * SDK: `client.browserRendering.markdown.create({ account_id, url })`
 */
export async function urlToMarkdown(
  env: Env,
  url: string,
): Promise<MarkdownResult> {
  try {
    const { client, accountId } = await createClient(env);

    const result = await client.browserRendering.markdown.create({
      account_id: accountId,
      url,
    });

    const raw = typeof result === "string"
      ? result
      : (result as any)?.result || JSON.stringify(result);

    return { success: true, markdown: cleanMarkdown(raw), url };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[BrowserRender] urlToMarkdown failed for "${url}":`, msg);
    return { success: false, markdown: "", url, error: msg };
  }
}

/**
 * Convert raw HTML to clean markdown.
 *
 * SDK: `client.browserRendering.markdown.create({ account_id, html })`
 */
export async function htmlToMarkdown(
  env: Env,
  html: string,
): Promise<MarkdownResult> {
  try {
    const { client, accountId } = await createClient(env);

    const result = await client.browserRendering.markdown.create({
      account_id: accountId,
      html,
    });

    const raw = typeof result === "string"
      ? result
      : (result as any)?.result || JSON.stringify(result);

    return { success: true, markdown: cleanMarkdown(raw) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[BrowserRender] htmlToMarkdown failed:", msg);
    return { success: false, markdown: "", error: msg };
  }
}

/**
 * Batch-convert multiple URLs to markdown.
 *
 * Capped at `concurrency` parallel requests to respect the
 * 10 req/s rate limit on Workers Paid plans.
 */
export async function batchUrlsToMarkdown(
  env: Env,
  urls: string[],
  concurrency = 5,
): Promise<MarkdownResult[]> {
  const results: MarkdownResult[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((url) => urlToMarkdown(env, url)),
    );
    results.push(...batchResults);
  }

  return results;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip noise from Browser Rendering markdown output.
 *
 * Removes navigation artifacts, images, and excessive whitespace
 * to reduce token count for AI consumption.
 */
function cleanMarkdown(raw: string): string {
  return raw
    // Remove 3+ blank lines → 2
    .replace(/\n{3,}/g, "\n\n")
    // Remove breadcrumb / nav link chains
    .replace(/^(?:\s*\[.*?\]\(.*?\)\s*[|>]\s*)+$/gm, "")
    // Remove image references (saves tokens, not useful for error analysis)
    .replace(/!\[.*?\]\(.*?\)/g, "")
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Collapse whitespace-only lines
    .replace(/^\s+$/gm, "")
    .trim();
}
