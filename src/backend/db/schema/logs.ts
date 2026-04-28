import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const logs = sqliteTable(
  "logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workerName: text("worker_name").notNull(),
    level: text("level").notNull(),
    message: text("message").notNull(),
    metadata: text("metadata"), // JSON string
    timestamp: integer("timestamp", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => {
    return {
      workerNameIdx: index("worker_name_idx").on(table.workerName),
    };
  },
);
