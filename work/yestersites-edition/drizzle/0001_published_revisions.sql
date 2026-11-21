CREATE TABLE `site_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`created` text NOT NULL,
	`metadata` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_revision_history` ON `site_revisions` (`slug`,`created`);--> statement-breakpoint
CREATE TABLE `revision_pages` (
	`rev` text NOT NULL,
	`page` text NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`rev`, `page`)
);
--> statement-breakpoint
CREATE TABLE `revision_media` (
	`rev` text NOT NULL,
	`num` integer NOT NULL,
	`src` text NOT NULL,
	PRIMARY KEY(`rev`, `num`)
);
--> statement-breakpoint
CREATE TABLE `site_counters` (
	`slug` text PRIMARY KEY NOT NULL,
	`views` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guest_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `guest_entries_by_site` ON `guest_entries` (`slug`,`id`);