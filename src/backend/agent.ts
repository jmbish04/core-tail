import { Ai } from "@cloudflare/workers-types";
import { Agent } from "agents";

type AgentState = {
  analysis: string | null;
  status: "idle" | "analyzing" | "complete" | "error";
};

interface Env {
  LOG_ANALYZER_AGENT: any; // DurableObjectNamespace
  AI: Ai;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  GEMINI_API_KEY?: string;
}

export class LogAnalyzerAgent extends Agent<Env, AgentState> {
  constructor(ctx: any, env: Env) {
    super(ctx, env);
  }
  initialState: AgentState = {
    analysis: null,
    status: "idle",
  };

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/analyze" && request.method === "POST") {
      this.setState({ ...this.state, status: "analyzing" });

      try {
        const data = (await request.json()) as {
          workerName: string;
          logId: number;
          message: string;
          metadata: string | null;
        };

        let sourceCode = "// Source code unavailable";
        if (this.env.CLOUDFLARE_ACCOUNT_ID && this.env.CLOUDFLARE_API_TOKEN) {
          const res = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/${data.workerName}`,
            {
              headers: {
                Authorization: `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
              },
            },
          );
          if (res.ok) {
            const scriptData = (await res.json()) as any;
            sourceCode = scriptData.result?.script || sourceCode;
          }
        }

        const promptText = `
          Analyze the following Cloudflare Worker error and provide a fix.
          Worker Name: ${data.workerName}
          Error Message: ${data.message}
          Metadata: ${data.metadata}
          Source Code:
          ${sourceCode}
          Provide a highly detailed analysis and a ready-to-copy prompt to fix the exact lines of code. Always output the full end-to-end code for every file you generate or modify. No exceptions or skipped lines.
        `;

        let analysisText = "";

        if (this.env.AI) {
          const aiResponse = (await this.env.AI.run("@cf/openai/gpt-oss-120b", {
            prompt: promptText,
          } as any)) as any;
          analysisText = aiResponse.response;
        } else {
          analysisText =
            "Simulated Analysis: The error is caused by a missing binding. \n\n```typescript\n// full code here\n```";
        }

        this.setState({
          status: "complete",
          analysis: analysisText,
        });

        return Response.json({ success: true, analysis: analysisText });
      } catch (err: any) {
        this.setState({ ...this.state, status: "error", analysis: err.message });
        return Response.json({ error: err.message }, { status: 500 });
      }
    }

    return Response.json({ state: this.state });
  }
}
