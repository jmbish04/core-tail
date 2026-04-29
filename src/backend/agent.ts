import { Agent } from "agents";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { errorAnalyses } from "@/db/index";
import { getSecret } from "@/utils/secrets";

type AgentState = {
  analysis: string | null;
  status: "idle" | "analyzing" | "complete" | "error";
  statusMessage: string | null;
};

export class LogAnalyzerAgent extends Agent<Env, AgentState> {
  constructor(ctx: any, env: Env) {
    super(ctx, env);
  }

  initialState: AgentState = {
    analysis: null,
    status: "idle",
    statusMessage: null,
  };

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/analyze" && request.method === "POST") {
      this.setState({ ...this.state, status: "analyzing", statusMessage: "Initializing analysis..." });

      try {
        const data = (await request.json()) as {
          workerName: string;
          logId: number;
          message: string;
          metadata: string | null;
          errorHash: string;
        };

        // Step 1: Check D1 cache first
        const db = drizzle(this.env.DB);
        const existing = await db
          .select()
          .from(errorAnalyses)
          .where(
            and(
              eq(errorAnalyses.workerName, data.workerName),
              eq(errorAnalyses.errorHash, data.errorHash),
              eq(errorAnalyses.status, "complete"),
            ),
          )
          .limit(1);

        if (existing.length > 0 && existing[0].analysisPrompt) {
          this.setState({ status: "complete", analysis: existing[0].analysisPrompt, statusMessage: "Loaded from cache" });
          return Response.json({
            success: true,
            analysis: existing[0].analysisPrompt,
            cached: true,
            createdAt: existing[0].createdAt?.toISOString(),
          });
        }

        // Step 2: Fetch worker source code
        this.setState({ ...this.state, statusMessage: "Fetching worker source code..." });
        let sourceCode = "// Source code unavailable";
        try {
          const accountId = await getSecret(this.env, "CLOUDFLARE_ACCOUNT_ID");
          const apiToken = await getSecret(this.env, "CLOUDFLARE_API_TOKEN");

          if (accountId && apiToken) {
            // Download the script content directly using Accept header
            const res = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${data.workerName}`,
              {
                headers: {
                  Authorization: `Bearer ${apiToken}`,
                  Accept: "application/javascript",
                },
              },
            );
            if (res.ok) {
              const contentType = res.headers.get("content-type") || "";
              if (contentType.includes("javascript") || contentType.includes("text")) {
                sourceCode = await res.text();
              } else {
                // Multipart response — try to extract script from body
                const body = await res.text();
                if (body.length > 0) sourceCode = body;
              }
            } else {
              console.error("[LogAnalyzerAgent] Source code fetch failed:", res.status, await res.text().catch(() => ""));
            }
          }
        } catch (fetchErr) {
          console.error("[LogAnalyzerAgent] Failed to fetch source code:", fetchErr);
        }

        // Step 3: Search Cloudflare docs for relevant context
        this.setState({ ...this.state, statusMessage: "Searching Cloudflare documentation..." });
        let docsContext = "";
        try {
          // Extract key error terms for search
          const errorKeywords = data.message
            .replace(/[^a-zA-Z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 3)
            .slice(0, 8)
            .join(" ");

          const searchQuery = `Workers ${errorKeywords}`;

          // Use Cloudflare AI Search for docs context
          const accountId = await getSecret(this.env, "CLOUDFLARE_ACCOUNT_ID");
          const searchToken = await getSecret(this.env, "CLOUDFLARE_AI_SEARCH_TOKEN");

          if (accountId && searchToken) {
            const searchRes = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai-search`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${searchToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  query: searchQuery,
                  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
                }),
              },
            );

            if (searchRes.ok) {
              const searchData = (await searchRes.json()) as any;
              if (searchData?.result?.response) {
                docsContext = searchData.result.response;
              }
            } else {
              console.error("[LogAnalyzerAgent] AI Search failed:", searchRes.status);
            }
          }
        } catch (docsErr) {
          console.error("[LogAnalyzerAgent] Failed to search docs:", docsErr);
          docsContext = "// Documentation search unavailable";
        }

        // Step 4: Generate AI analysis
        this.setState({ ...this.state, statusMessage: "Generating fix prompt with AI..." });

        const promptText = `You are an expert Cloudflare Workers debugger. Analyze the following error and generate a complete, ready-to-use prompt that a coding agent can use to fix this exact error.

## Error Context
- **Worker Name:** ${data.workerName}
- **Error Message:** ${data.message}
- **Metadata:** ${data.metadata || "None"}

## Worker Source Code
\`\`\`javascript
${sourceCode.substring(0, 15000)}
\`\`\`

## Relevant Cloudflare Documentation
${docsContext || "No documentation context available."}

## Your Task
Generate a comprehensive fix prompt that includes:
1. **Root Cause Analysis** — What exactly is causing this error
2. **Cloudflare-Specific Context** — Any relevant Workers runtime behaviors, limits, or configuration issues
3. **Step-by-Step Fix** — Exact code changes needed with file paths
4. **Complete Code** — Output the full corrected source code for every file that needs changes. Never use shortcuts like "// rest of code" or "..." — always output complete files.

Format the output as a prompt that can be copied directly to a coding agent (like Cursor, Copilot, or Claude) to implement the fix.`;

        let analysisText = "";

        if (this.env.AI) {
          const aiResponse = (await this.env.AI.run("@cf/openai/gpt-oss-120b", {
            prompt: promptText,
          } as any)) as any;
          analysisText = aiResponse.response || "AI analysis returned empty response.";
        } else {
          analysisText = `## Root Cause Analysis\n\nUnable to perform AI analysis — AI binding not available.\n\n## Error\n\n\`\`\`\n${data.message}\n\`\`\`\n\n## Source Code Snapshot\n\n\`\`\`javascript\n${sourceCode.substring(0, 5000)}\n\`\`\``;
        }

        // Step 5: Persist to D1
        this.setState({ ...this.state, statusMessage: "Saving analysis..." });
        try {
          // Upsert — delete old if exists, then insert
          await db
            .delete(errorAnalyses)
            .where(
              and(
                eq(errorAnalyses.workerName, data.workerName),
                eq(errorAnalyses.errorHash, data.errorHash),
              ),
            );

          await db.insert(errorAnalyses).values({
            workerName: data.workerName,
            errorHash: data.errorHash,
            errorMessage: data.message,
            sourceCode: sourceCode.substring(0, 50000),
            docsContext: docsContext.substring(0, 10000),
            analysisPrompt: analysisText,
            status: "complete",
          });
        } catch (dbErr) {
          console.error("[LogAnalyzerAgent] Failed to persist to D1:", dbErr);
          // Non-fatal — we still return the analysis
        }

        this.setState({
          status: "complete",
          analysis: analysisText,
          statusMessage: "Analysis complete",
        });

        return Response.json({ success: true, analysis: analysisText, cached: false });
      } catch (err: any) {
        console.error("[LogAnalyzerAgent] Analysis failed:", err);
        this.setState({ ...this.state, status: "error", analysis: err.message, statusMessage: "Analysis failed" });
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ state: this.state });
  }
}
