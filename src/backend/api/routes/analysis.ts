import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { Bindings } from "../index";

const analysisRouter = new Hono<{ Bindings: Bindings }>();

analysisRouter.post(
  "/analyze",
  zValidator(
    "json",
    z.object({
      workerName: z.string(),
      logId: z.number(),
      message: z.string(),
      metadata: z.string().nullable(),
    }),
  ),
  async (c) => {
    const { workerName, logId, message, metadata } = c.req.valid("json");

    // Pass to LogAnalyzerAgent DO
    const agentId = c.env.LOG_ANALYZER_AGENT.idFromName(workerName);
    const agentStub = c.env.LOG_ANALYZER_AGENT.get(agentId);

    const response = await agentStub.fetch("http://agent/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workerName, logId, message, metadata }),
    });

    if (!response.ok) {
      return c.json({ error: "Agent analysis failed" }, 500);
    }

    const result = await response.json();
    return c.json(result, 200);
  },
);

export { analysisRouter };
