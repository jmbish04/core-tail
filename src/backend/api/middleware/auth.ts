import { createMiddleware } from "hono/factory";

import type { Bindings, Variables } from "../index";

export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];

    // For the admin dashboard, we just use the WEBHOOK_SECRET as a simple password
    if (c.env.WEBHOOK_SECRET && token === c.env.WEBHOOK_SECRET) {
      // Treat as admin
      c.set("userId", 1); // Mock user ID for admin
      return next();
    }

    return c.json({ error: "Unauthorized" }, 401);
  },
);
