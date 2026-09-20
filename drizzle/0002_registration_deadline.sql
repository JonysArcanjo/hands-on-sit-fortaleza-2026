CREATE TABLE `event_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`registration_deadline` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "event_settings_singleton" CHECK("event_settings"."id" = 1)
);
--> statement-breakpoint
INSERT INTO `event_settings` (`id`, `registration_deadline`) VALUES (1, NULL);
