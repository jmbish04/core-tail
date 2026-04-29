import { Agent } from "agents";
import { WorkersAI } from "@/backend/workersai";
import type { WorkerLogEntry } from "@/backend/agent/types";


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