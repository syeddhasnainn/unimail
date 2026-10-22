CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`label` text NOT NULL,
	`color` text NOT NULL,
	`imap_host` text NOT NULL,
	`imap_port` integer NOT NULL,
	`smtp_host` text NOT NULL,
	`smtp_port` integer NOT NULL,
	`username` text NOT NULL,
	`password_enc` text NOT NULL,
	`sync_error` text,
	`last_synced_at` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_email_unique` ON `accounts` (`email`);--> statement-breakpoint
CREATE TABLE `bodies` (
	`message_id` integer PRIMARY KEY NOT NULL,
	`html` text,
	`text` text,
	`attachments` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mailboxes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`path` text NOT NULL,
	`role` text,
	`uid_validity` text,
	`last_uid` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mailboxes_account_path` ON `mailboxes` (`account_id`,`path`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`mailbox_id` integer NOT NULL,
	`uid` integer NOT NULL,
	`message_id` text,
	`in_reply_to` text,
	`references` text,
	`subject` text DEFAULT '' NOT NULL,
	`from_name` text,
	`from_address` text,
	`to` text DEFAULT '[]' NOT NULL,
	`cc` text DEFAULT '[]' NOT NULL,
	`date` integer NOT NULL,
	`snippet` text DEFAULT '' NOT NULL,
	`seen` integer DEFAULT false NOT NULL,
	`flagged` integer DEFAULT false NOT NULL,
	`answered` integer DEFAULT false NOT NULL,
	`has_attachments` integer DEFAULT false NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mailbox_id`) REFERENCES `mailboxes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_mailbox_uid` ON `messages` (`mailbox_id`,`uid`);--> statement-breakpoint
CREATE INDEX `messages_date` ON `messages` (`date`);--> statement-breakpoint
CREATE INDEX `messages_account_date` ON `messages` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
