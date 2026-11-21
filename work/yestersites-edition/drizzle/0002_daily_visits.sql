CREATE TABLE `daily_visits` (
	`day` text NOT NULL,
	`slug` text NOT NULL,
	`views` integer NOT NULL,
	PRIMARY KEY(`day`, `slug`)
);
