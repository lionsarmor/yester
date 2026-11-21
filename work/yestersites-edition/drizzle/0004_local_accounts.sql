CREATE TABLE `local_accounts` (
	`owner` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`rounds` integer NOT NULL,
	`recovery` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_accounts_email_unique` ON `local_accounts` (`email`);--> statement-breakpoint
CREATE TABLE `member_sessions` (
	`digest` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `member_sessions_owner` ON `member_sessions` (`owner`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`bucket` text PRIMARY KEY NOT NULL,
	`expires` integer NOT NULL,
	`attempts` integer NOT NULL
);
