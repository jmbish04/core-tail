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