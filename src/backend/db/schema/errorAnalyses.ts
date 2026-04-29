import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const errorAnalyses = sqliteTable(
  "error_analyses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workerName: text("worker_name").notNull(),
    errorHash: text("error_hash").notNull(),
    errorMessage: text("error_message").notNull(),
    sourceCode: text("source_code"),
    docsContext: text("docs_context"),
    analysisPrompt: text("analysis_prompt"),
    status: text("status").notNull().default("pending"), // 'pending' | 'analyzing' | 'complete' | 'error'
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("error_analyses_worker_hash_idx").on(
      table.workerName,
      table.errorHash,
    ),
  ],
);
