CREATE TABLE `financing_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`name` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `financing_charges_property_idx` ON `financing_charges` (`property_id`);--> statement-breakpoint
ALTER TABLE `recurring_amounts` ADD `financing_charge_id` text REFERENCES financing_charges(id) ON DELETE cascade;--> statement-breakpoint
CREATE INDEX `recurring_amounts_financing_charge_idx` ON `recurring_amounts` (`financing_charge_id`,`valid_from`);--> statement-breakpoint
-- Each flat's existing financing charge periods become one charge without a
-- name (openspec: recurring-amounts, "Existing financing charges become
-- unnamed charges"). Only rows without a charge are touched.
INSERT INTO `financing_charges` (`id`, `property_id`, `name`)
  SELECT lower(hex(randomblob(16))), `property_id`, NULL
  FROM `recurring_amounts`
  WHERE `kind` = 'financing_charge' AND `financing_charge_id` IS NULL
  GROUP BY `property_id`;--> statement-breakpoint
UPDATE `recurring_amounts` SET `financing_charge_id` = (
  SELECT `id` FROM `financing_charges`
  WHERE `financing_charges`.`property_id` = `recurring_amounts`.`property_id`
    AND `financing_charges`.`name` IS NULL
  LIMIT 1
)
WHERE `kind` = 'financing_charge' AND `financing_charge_id` IS NULL;
