CREATE TABLE `ownership_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`share` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	`reason` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ownership_periods_property_idx` ON `ownership_periods` (`property_id`,`valid_from`);--> statement-breakpoint
-- Backfill (written by hand): every existing flat's owner owns 100 % from the
-- day the flat was added (created_at is epoch milliseconds). They can correct
-- the date on the flat's ownership page.
INSERT INTO `ownership_periods` (`id`, `property_id`, `user_id`, `share`, `valid_from`, `valid_to`, `reason`)
SELECT lower(hex(randomblob(16))), `property_access`.`property_id`, `property_access`.`user_id`, 10000, date(`properties`.`created_at` / 1000, 'unixepoch'), NULL, NULL
FROM `property_access`
JOIN `properties` ON `properties`.`id` = `property_access`.`property_id`
WHERE `property_access`.`role` = 'owner';
