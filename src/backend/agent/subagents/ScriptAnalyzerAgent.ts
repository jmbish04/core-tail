import { Agent } from "agents";
import { WorkersAI } from "@/backend/workersai";
import type { WorkerLogEntry } from "@/backend/agent/types";

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
