CREATE TABLE `error_analyses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worker_name` text NOT NULL,
	`error_hash` text NOT NULL,
	`error_message` text NOT NULL,
	`source_code` text,
	`docs_context` text,
	`analysis_prompt` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `error_analyses_worker_hash_idx` ON `error_analyses` (`worker_name`,`error_hash`);