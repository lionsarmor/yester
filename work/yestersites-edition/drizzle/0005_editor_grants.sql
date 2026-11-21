CREATE TABLE `editor_grants` (
	`digest` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`slug` text NOT NULL,
	`revision` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `editor_grants_expiry` ON `editor_grants` (`expires`);