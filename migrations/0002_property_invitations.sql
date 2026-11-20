CREATE TABLE `property_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`email` text NOT NULL,
	`invited_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_invitations_email_idx` ON `property_invitations` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `property_invitations_property_email` ON `property_invitations` (`property_id`,`email`);