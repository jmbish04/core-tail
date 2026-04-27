import { zValidator } from "@hono/zod-validator";
import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";

import type { Bindings } from "../index";

import { logs } from "../../db/schema";

const logsRouter = new Hono<{ Bindings: Bindings }>();

logsRouter.get(
  "/",
  zValidator(
    "query",
    z.object({
      workerName: z.string().optional(),
      limit: z.string().optional().default("100"),
      offset: z.string().optional().default("0"),
    }),
  ),
  async (c) => {
    const db = drizzle(c.env.DB);
    const { workerName, limit, offset } = c.req.valid("query");

    let query = db.select().from(logs).$dynamic();

    if (workerName) {
      query = query.where(eq(logs.workerName, workerName));
    }

    const results = await query
      .orderBy(desc(logs.timestamp))
      .limit(parseInt(limit, 10))
      .offset(parseInt(offset, 10))
      .execute();

    return c.json(results, 200);
  },
);

logsRouter.get("/metrics", async (c) => {
  const db = drizzle(c.env.DB);
  const results = await db
    .select({
      workerName: logs.workerName,
      level: logs.level,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(logs)
    .groupBy(logs.workerName, logs.level)
    .execute();

  return c.json(results, 200);
});

export { logsRouter };
