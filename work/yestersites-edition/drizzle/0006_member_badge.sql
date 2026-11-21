ALTER TABLE member_sessions ADD COLUMN badge text;
--> statement-breakpoint
CREATE INDEX member_sessions_badge ON member_sessions (badge);
