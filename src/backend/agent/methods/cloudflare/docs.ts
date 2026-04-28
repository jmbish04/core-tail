/**
 * @fileoverview Cloudflare documentation search via the cloudflare-docs MCP server.
 *
 * Connects to the remote MCP server at https://docs.mcp.cloudflare.com/mcp
 * using streamable-http transport to call `search_cloudflare_documentation`.
 * Integrates an iterative AI-driven search loop and uses Browser Rendering
 * to parse the full markdown of the documentation pages.
 */

import type { DocsSearchResult } from "@/backend/agent/types";
import { batchUrlsToMarkdown } from "@/backend/agent/methods/cloudflare/browser-render";

// ── MCP Server Configuration ────────────────────────────────────────────────

const MCP_ENDPOINT = "https://docs.mcp.cloudflare.com/mcp";

export const getDocsTools = (_env: Env) => {
  return ["search_cloudflare_documentation"];
};

export const getConfig = (_env: Env): any => ({
  name: "cloudflare-docs",
  url: MCP_ENDPOINT,
  transport: {
    type: "streamable-http",
    headers: {},
  },
});

// ── MCP Client ──────────────────────────────────────────────────────────────

let rpcId = 0;

async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<any> {
  const body = {
    jsonrpc: "2.0",
    id: ++rpcId,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
    },
  };

  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `[Agent:Docs] MCP call failed: ${response.status} ${response.statusText}`,
    );
  }

  const text = await response.text();

  const lines = text.split("\n").filter((l) => l.startsWith("data:"));
  if (lines.length > 0) {
    const lastData = lines[lines.length - 1].replace(/^data:\s*/, "");
    try {
      return JSON.parse(lastData);
    } catch {
      // Not SSE, try parsing full response
    }
  }

  return JSON.parse(text);
}

function extractMcpText(response: any): string {
  if (response?.result?.content) {
    return response.result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
  }
  return typeof response === "string" ? response : JSON.stringify(response);
}

export async function searchDocs(
  _env: Env,
  query: string,
): Promise<DocsSearchResult[]> {
  try {
    const response = await callMcpTool("search_cloudflare_documentation", {
      query,
    });

    const text = extractMcpText(response);
    return parseDocsResponse(text);
  } catch (error) {
    console.error("[Agent:Docs] MCP search failed, falling back:", error);
    return fallbackDocSearch(query);
  }
}

// ── Iterative AI Search Loop ────────────────────────────────────────────────

/**
 * Iteratively search documentation based on the error message.
 *
 * The AI generates queries, we search the MCP, fetch the URLs using Browser Rendering,
 * and if the AI still has questions, it loops.
 */
export async function buildDocsContext(
  env: Env,
  errorMessage: string,
  workerName: string,
): Promise<{ docs: DocsSearchResult[]; contextString: string }> {
  const MAX_ITERATIONS = 3;
  let iteration = 0;
  
  const gatheredContext: string[] = [];
  const allDocsFound: DocsSearchResult[] = [];
  const seenUrls = new Set<string>();

  // If AI binding isn't available, fallback to single generic search
  if (!env.AI) {
    console.warn("[Agent:Docs] AI binding missing, doing static search fallback");
    const results = await searchDocs(env, `Cloudflare Workers error: ${errorMessage.slice(0, 100)}`);
    return { docs: results, contextString: results.map(r => r.snippet).join("\n") };
  }

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // 1. Ask the AI what queries it wants to run
    const promptText = `
You are an expert at searching Cloudflare Documentation.
We are debugging an error in a Cloudflare Worker named "${workerName}".
Error message:
${errorMessage}

So far, we have gathered this documentation context:
${gatheredContext.length > 0 ? gatheredContext.join("\n\n") : "None."}

Based on the error and the context gathered so far, do you have enough information to fix the error?
If YES, output an empty JSON array: []
If NO, what documentation queries should we run next?
Output a JSON array of up to 2 search query strings. Do not output anything else.
Example: ["D1 database bindings", "Workers AI limitations"]
`;

    const aiResponse = (await env.AI.run("@cf/openai/gpt-oss-120b", {
      prompt: promptText,
    } as any)) as any;

    const rawResponseText = aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
    
    // 2. Parse the JSON array from the response
    let queries: string[] = [];
    try {
      const match = rawResponseText.match(/\[.*\]/s);
      if (match) {
        queries = JSON.parse(match[0]);
      }
    } catch (e) {
      console.warn("[Agent:Docs] Failed to parse AI query array, stopping iteration.");
      break;
    }

    if (!Array.isArray(queries) || queries.length === 0) {
      console.log("[Agent:Docs] AI satisfied with current docs context.");
      break;
    }

    console.log(`[Agent:Docs] Iteration ${iteration}, running queries:`, queries);

    // 3. Execute MCP searches
    const iterResults: DocsSearchResult[] = [];
    for (const q of queries.slice(0, 2)) {
      const results = await searchDocs(env, q);
      iterResults.push(...results);
      allDocsFound.push(...results);
    }

    // Extract unique URLs we haven't seen yet
    const newUrls = [...new Set(iterResults.map((r) => r.url).filter(Boolean))].filter(
      (url) => !seenUrls.has(url!)
    ) as string[];

    if (newUrls.length === 0) {
      console.log("[Agent:Docs] No new URLs found, stopping iteration to prevent loop.");
      break;
    }

    // 4. Fetch full markdown using Browser Rendering (cap at top 3 per iteration to manage tokens)
    const urlsToFetch = newUrls.slice(0, 3);
    urlsToFetch.forEach(u => seenUrls.add(u));

    const renderedPages = await batchUrlsToMarkdown(env, urlsToFetch, 3);
    
    let addedUsefulContext = false;
    for (const page of renderedPages) {
      if (page.success && page.markdown.length > 100) {
        gatheredContext.push(`### Source: ${page.url}\n\n${page.markdown.slice(0, 6000)}`); // cap each page at 6k chars
        addedUsefulContext = true;
      }
    }

    if (!addedUsefulContext) {
      console.log("[Agent:Docs] Browser rendering yielded no useful text, stopping iteration.");
      break;
    }
  }

  const contextString = gatheredContext.length
    ? gatheredContext.join("\n\n---\n\n")
    : "No detailed documentation could be gathered.";

  return { docs: allDocsFound, contextString };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseDocsResponse(text: string): DocsSearchResult[] {
  const results: DocsSearchResult[] = [];
  const sections = text.split(/(?=^#{1,3}\s|\n---\n)/m).filter(Boolean);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 20) continue;

    const titleMatch = trimmed.match(/^#{1,3}\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : trimmed.split("\n")[0].slice(0, 100);

    const urlMatch = trimmed.match(/https:\/\/developers\.cloudflare\.com[^\s)]+/);

    results.push({
      title,
      url: urlMatch ? urlMatch[0] : "",
      snippet: trimmed.slice(0, 500),
    });
  }

  if (results.length === 0 && text.length > 20) {
    results.push({
      title: "Cloudflare Documentation",
      url: "",
      snippet: text.slice(0, 500),
    });
  }

  return results;
}

function fallbackDocSearch(query: string): DocsSearchResult[] {
  return [
    {
      title: "Cloudflare Workers Errors",
      url: "https://developers.cloudflare.com/workers/observability/errors/",
      snippet: `Search docs for: "${query.slice(0, 100)}"`,
    },
  ];
}
