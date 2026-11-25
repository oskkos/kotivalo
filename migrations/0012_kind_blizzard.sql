CREATE TABLE `property_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`tenancy_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`key` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`filename` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `property_documents_property_date_idx` ON `property_documents` (`property_id`,`date`);--> statement-breakpoint
CREATE INDEX `property_documents_uploaded_by_idx` ON `property_documents` (`uploaded_by`);