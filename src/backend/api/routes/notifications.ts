/**
 * @fileoverview Notifications API routes
 */

import { desc, eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";

import { notifications } from "@/db/index";
import { authMiddleware } from "../middleware/auth";

const notificationsRouter = new Hono<{ Bindings: Env }>();

// Apply auth middleware
notificationsRouter.use("*", authMiddleware);

// GET /api/notifications
notificationsRouter.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const unreadOnly = c.req.query("unreadOnly") === "true";

  try {
    const query = db.select().from(notifications).$dynamic();

    if (unreadOnly) {
      query.where(eq(notifications.isRead, false));
    }

    const allNotifications = await query.orderBy(desc(notifications.createdAt)).limit(100);

    const unreadCount = allNotifications.filter((n) => !n.isRead).length;

    return c.json({
      notifications: allNotifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return c.json({ error: "Failed to fetch notifications" }, 500);
  }
});

// PUT /api/notifications/:id/read
notificationsRouter.put("/:id/read", async (c) => {
  const db = drizzle(c.env.DB);
  const notificationId = parseInt(c.req.param("id"));

  try {
    const notif = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (notif.length === 0) {
      return c.json({ error: "Notification not found" }, 404);
    }

    // Mark as read
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));

    return c.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error updating notification:", error);
    return c.json({ error: "Failed to update notification" }, 500);
  }
});

// PUT /api/notifications/read-all
notificationsRouter.put("/read-all", async (c) => {
  const db = drizzle(c.env.DB);

  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.isRead, false));

    return c.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error updating notifications:", error);
    return c.json({ error: "Failed to update notifications" }, 500);
  }
});

export { notificationsRouter };
