import { createMiddleware } from "hono/factory";
import { getWorkerApiKey } from "@/utils/secrets";

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];

    // Simple token auth using WORKER_API_KEY
    const apiKey = await getWorkerApiKey(c.env as unknown as Env);
    if (apiKey && token === apiKey) {
      return next();
    }

    return c.json({ error: "Unauthorized" }, 401);
  },
);
