CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`filename` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipts_transaction_id_unique` ON `receipts` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `receipts_uploaded_by_idx` ON `receipts` (`uploaded_by`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_property_date_idx` ON `transactions` (`property_id`,`date`);