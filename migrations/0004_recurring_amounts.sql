CREATE TABLE `financing_treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`treatment` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `financing_treatments_property_idx` ON `financing_treatments` (`property_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `recurring_amounts` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recurring_amounts_property_idx` ON `recurring_amounts` (`property_id`,`kind`,`valid_from`);