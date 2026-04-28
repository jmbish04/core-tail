/**
 * @fileoverview LogAnalyzerAgent — Durable Object powered by the Agents SDK.
 *
 * Orchestrates error analysis by:
 * 1. Fetching the failing worker's source code via the Cloudflare SDK
 * 2. Pulling recent logs/errors for that worker
 * 3. Searching Cloudflare docs for relevant guidance
 * 4. Sending the full context to Workers AI to produce a fix prompt
 *
 * All upstream interactions use the `cloudflare` npm SDK — no raw fetch().
 */

import { Agent } from "agents";

import type { AgentState, AnalyzeRequest, AnalysisContext } from "@/backend/agent/types";
import { checkAgentHealth } from "@/backend/agent/health";
import { fetchWorkerScript } from "@/backend/agent/methods/cloudflare/workers/script";
import { fetchWorkerLogs, fetchWorkerErrors } from "@/backend/agent/methods/cloudflare/workers/logs";
import { buildDocsContext } from "@/backend/agent/methods/cloudflare/docs";

export class LogAnalyzerAgent extends Agent<Env, AgentState> {
  initialState: AgentState = {
    analysis: null,
    status: "idle",
    lastAnalyzedWorker: null,
    lastAnalyzedAt: null,
  };

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── Health check ──────────────────────────────────────────────
    if (url.pathname === "/health") {
      const health = await checkAgentHealth(this.env);
      return Response.json({
        agent: "LogAnalyzerAgent",
        state: this.state,
        ...health,
      });
    }

    // ── Analyze endpoint ──────────────────────────────────────────
    if (url.pathname === "/analyze" && request.method === "POST") {
      return this.handleAnalyze(request);
    }

    // ── Default: return current state ─────────────────────────────
    return Response.json({ state: this.state });
  }

  /**
   * Core analysis workflow.
   *
   * Gathers context from 3 sources in parallel, then feeds it all
   * into Workers AI to produce a comprehensive fix prompt.
   */
  private async handleAnalyze(request: Request): Promise<Response> {
    this.setState({ ...this.state, status: "analyzing" });

    try {
      const data = (await request.json()) as AnalyzeRequest;

      // ── Phase 1: Gather context in parallel ───────────────────
      const [scriptResult, logsResult, docsResult] = await Promise.all([
        fetchWorkerScript(this.env, data.workerName),
        fetchWorkerErrors(this.env, data.workerName, 60),
        buildDocsContext(this.env, data.message, data.workerName),
      ]);

      const context: AnalysisContext = {
        workerName: data.workerName,
        errorMessage: data.message,
        metadata: data.metadata,
        sourceCode: scriptResult.content,
        recentLogs: logsResult,
        relevantDocs: docsResult.docs,
      };

      // ── Phase 2: AI analysis ──────────────────────────────────
      const analysisText = await this.runAIAnalysis(context, docsResult.contextString);

      this.setState({
        status: "complete",
        analysis: analysisText,
        lastAnalyzedWorker: data.workerName,
        lastAnalyzedAt: new Date().toISOString(),
      });

      return Response.json({
        success: true,
        analysis: analysisText,
        context: {
          scriptAvailable: scriptResult.success,
          recentErrorCount: logsResult.length,
          docsReferencesCount: docsResult.docs.length,
        },
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ ...this.state, status: "error", analysis: message });
      return Response.json({ error: message }, { status: 500 });
    }
  }

  /**
   * Run the AI analysis with full context.
   *
   * Constructs a detailed prompt that includes source code, error logs,
   * and relevant documentation, then invokes Workers AI.
   */
  private async runAIAnalysis(
    context: AnalysisContext,
    docsContextString: string,
  ): Promise<string> {
    const recentLogsFormatted = context.recentLogs.length
      ? context.recentLogs
          .slice(0, 20)
          .map((l) => `[${l.level}] ${l.timestamp}: ${l.message}`)
          .join("\n")
      : "No recent error logs available.";

    const promptText = `You are an expert Cloudflare Workers debugger. Analyze the following error and produce a detailed fix.

## Worker
Name: ${context.workerName}

## Error
${context.errorMessage}

## Metadata
${context.metadata || "None"}

## Recent Error Logs
${recentLogsFormatted}

## Source Code
\`\`\`typescript
${context.sourceCode}
\`\`\`

## Relevant Cloudflare Documentation
${docsContextString}

## Instructions
1. Identify the root cause of the error.
2. Explain why this error occurs in the Cloudflare Workers runtime.
3. Reference specific Cloudflare documentation where applicable.
4. Provide a ready-to-copy prompt that a coding agent can use to fix the issue.
5. In your fix prompt, output the FULL end-to-end corrected code for every file. No shortcuts, no "// rest of code" placeholders.

Format your response as:

### Root Cause
[explanation]

### Cloudflare-Specific Context
[relevant Workers runtime details from docs]

### Fix Prompt
[complete prompt for a coding agent including full corrected code]`;

    if (!this.env.AI) {
      return `[Simulated Analysis] AI binding unavailable.\n\nError in ${context.workerName}: ${context.errorMessage}\n\nSource code retrieved: ${context.sourceCode.length} chars\nRecent errors: ${context.recentLogs.length}\nDocs references: ${context.relevantDocs.length}`;
    }

    const aiResponse = (await this.env.AI.run("@cf/openai/gpt-oss-120b", {
      prompt: promptText,
    } as any)) as any;

    return aiResponse.response || aiResponse.text || JSON.stringify(aiResponse);
  }
}
