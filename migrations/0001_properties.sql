CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`street_address` text NOT NULL,
	`postcode` text NOT NULL,
	`city` text NOT NULL,
	`room_count` integer NOT NULL,
	`floor_area` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `property_access` (
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`property_id`, `user_id`),
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_access_user_id_idx` ON `property_access` (`user_id`);