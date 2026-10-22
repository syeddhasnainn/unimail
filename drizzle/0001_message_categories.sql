ALTER TABLE `messages` ADD `category` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `category_reason` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `category_source` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `classify_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `messages_category` ON `messages` (`category`);