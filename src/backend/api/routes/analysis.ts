import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { errorAnalyses } from "@/db/index";

const analysisRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/analysis/lookup
 * Check if an analysis already exists for a workerName + errorHash
 */
analysisRouter.get(
  "/lookup",
  zValidator(
    "query",
    z.object({
      workerName: z.string(),
      errorHash: z.string(),
    }),
  ),
  async (c) => {
    const { workerName, errorHash } = c.req.valid("query");
    const db = drizzle(c.env.DB);

    const results = await db
      .select()
      .from(errorAnalyses)
      .where(
        and(
          eq(errorAnalyses.workerName, workerName),
          eq(errorAnalyses.errorHash, errorHash),
        ),
      )
      .limit(1);

    if (results.length > 0 && results[0].status === "complete" && results[0].analysisPrompt) {
      return c.json(
        {
          exists: true,
          analysis: {
            id: results[0].id,
            workerName: results[0].workerName,
            errorMessage: results[0].errorMessage,
            analysisPrompt: results[0].analysisPrompt,
            status: results[0].status,
            createdAt: results[0].createdAt?.toISOString(),
            updatedAt: results[0].updatedAt?.toISOString(),
          },
        },
        200,
      );
    }

    return c.json({ exists: false }, 200);
  },
);

/**
 * POST /api/analysis/analyze
 * Trigger AI analysis for a worker error via the LogAnalyzerAgent DO
 */
analysisRouter.post(
  "/analyze",
  zValidator(
    "json",
    z.object({
      workerName: z.string(),
      logId: z.number(),
      message: z.string(),
      metadata: z.string().nullable(),
      errorHash: z.string(),
    }),
  ),
  async (c) => {
    const { workerName, logId, message, metadata, errorHash } = c.req.valid("json");

    // Pass to LogAnalyzerAgent DO
    const agentId = c.env.LOG_ANALYZER_AGENT.idFromName(workerName);
    const agentStub = c.env.LOG_ANALYZER_AGENT.get(agentId);

    const response = await agentStub.fetch("http://agent/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workerName, logId, message, metadata, errorHash }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[analysis] Agent failed:", errBody);
      return c.json({ error: "Agent analysis failed", details: errBody }, 500);
    }

    const result = await response.json();
    return c.json(result, 200);
  },
);

export { analysisRouter };
