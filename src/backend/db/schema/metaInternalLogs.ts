import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const metaInternalLogs = sqliteTable("meta_internal_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  event: text("event").notNull(),
  details: text("details"),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
