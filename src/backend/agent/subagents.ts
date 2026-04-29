import { Agent } from "agents";
import { WorkersAI } from "@/backend/workersai";
import type { WorkerLogEntry } from "@/backend/agent/types";

/**
 * LogParserAgent
 * Uses Qwen (great at parsing structured traces and code context) to analyze recent logs.
 */
export class LogParserAgent extends Agent<Env> {
  async analyzeLogs(logs: WorkerLogEntry[], errorMessage: string): Promise<string> {
    const ai = new WorkersAI(this.env);

    const recentLogsFormatted = logs.length
      ? logs.slice(0, 50).map((l) => `[${l.level}] ${l.timestamp}: ${l.message}`).join("\n")
      : "No recent error logs available.";

    const prompt = `You are a Log Analysis expert. The worker threw the following error:
${errorMessage}

Here are the recent logs leading up to the error:
${recentLogsFormatted}

Identify any specific stack trace anomalies, missing variables, or operational context that led to this error.
Provide a concise, highly technical summary of the log analysis.`;

    // Qwen model for structured log context parsing
    return await ai.generateText("@cf/qwen/qwen2.5-coder-32b-instruct", { prompt, max_tokens: 1024 });
  }
}

/**
 * DocsResearcherAgent
 * Uses Llama 3.3 (fast reasoning) to summarize Cloudflare documentation.
 */
export class DocsResearcherAgent extends Agent<Env> {
  async summarizeDocs(errorMessage: string, rawDocsContext: string): Promise<string> {
    if (!rawDocsContext || rawDocsContext.trim() === "") {
      return "No relevant documentation found for this error.";
    }

    const ai = new WorkersAI(this.env);
    
    const prompt = `You are a Cloudflare Documentation expert. The worker threw the following error:
${errorMessage}

Here are the relevant snippets from the Cloudflare documentation retrieved for this error:
${rawDocsContext}

Extract and summarize the specifically relevant constraints, workarounds, or API usage rules needed to fix this error. Ignore irrelevant parts of the documentation. Provide a concise, highly technical summary.`;

    // Llama 3.3 for fast reasoning and reading comprehension
    return await ai.generateText("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { prompt, max_tokens: 1024 });
  }
}

/**
 * ScriptAnalyzerAgent
 * Uses Kimi K2.6 (massive 262k context window) to analyze the entire worker script.
 */
export class ScriptAnalyzerAgent extends Agent<Env> {
  async analyzeScript(sourceCode: string, errorMessage: string): Promise<string> {
    const ai = new WorkersAI(this.env);

    const prompt = `You are an Architectural Code Analysis expert. The worker threw the following error:
${errorMessage}

Here is the entire un-truncated source code for the worker:
\`\`\`typescript
${sourceCode}
\`\`\`

Analyze the script and isolate the specific lines, architectural decisions, or state management flaws that caused the failure. Provide a highly technical summary of the code defects.`;

    // Kimi K2.6 is the heavyweight model for huge context windows
    return await ai.generateText("@cf/moonshotai/kimi-k2.6", { prompt, max_tokens: 2048 });
  }
}
