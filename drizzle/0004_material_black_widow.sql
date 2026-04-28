CREATE TABLE `meta_internal_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`details` text,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL
);
