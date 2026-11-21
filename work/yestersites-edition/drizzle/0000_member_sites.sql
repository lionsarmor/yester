CREATE TABLE `member_sites` (
	`slug` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`creator_key` text NOT NULL,
	`title` text NOT NULL,
	`profile` text NOT NULL,
	`theme` text NOT NULL,
	`byline` text NOT NULL,
	`listed` integer NOT NULL,
	`blocks_json` text NOT NULL,
	`links_json` text NOT NULL,
	`snippet` text NOT NULL,
	`keywords_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `member_sites_by_owner` ON `member_sites` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `member_sites_listed` ON `member_sites` (`listed`,`slug`);--> statement-breakpoint
CREATE INDEX `member_sites_creator` ON `member_sites` (`creator_key`,`listed`,`slug`);