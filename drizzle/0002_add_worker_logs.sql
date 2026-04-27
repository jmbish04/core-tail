CREATE TABLE IF NOT EXISTS `worker_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`worker_name` text NOT NULL,
	`event_timestamp` integer NOT NULL,
	`outcome` text NOT NULL,
	`script_name` text,
	`logs` text,
	`exceptions` text,
	`status_code` integer,
	`request_url` text,
	`request_method` text
);
