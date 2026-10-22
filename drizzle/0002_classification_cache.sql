CREATE TABLE `classifications` (
	`account_id` integer NOT NULL,
	`message_id` text NOT NULL,
	`category` text NOT NULL,
	`reason` text,
	`source` text NOT NULL,
	PRIMARY KEY(`account_id`, `message_id`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT OR IGNORE INTO `classifications` (`account_id`, `message_id`, `category`, `reason`, `source`)
SELECT `account_id`, `message_id`, `category`, `category_reason`, `category_source` FROM `messages`
WHERE `category` IS NOT NULL AND `message_id` IS NOT NULL AND `category_source` = 'user';--> statement-breakpoint
INSERT OR IGNORE INTO `classifications` (`account_id`, `message_id`, `category`, `reason`, `source`)
SELECT `account_id`, `message_id`, `category`, `category_reason`, coalesce(`category_source`, 'ai') FROM `messages`
WHERE `category` IS NOT NULL AND `message_id` IS NOT NULL;
