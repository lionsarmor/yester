CREATE TABLE `webmasters` (
	`owner` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`joined` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `webmasters_handle_unique` ON `webmasters` (`handle`);