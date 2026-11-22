CREATE TABLE `tenancies` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenant_name` text NOT NULL,
	`tenant_phone` text,
	`tenant_email` text,
	`contract_type` text NOT NULL,
	`contract_made` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`term_end` text,
	`due_day` integer NOT NULL,
	`notice_given_by` text,
	`notice_date` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tenancies_property_idx` ON `tenancies` (`property_id`,`valid_from`);