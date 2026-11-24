CREATE TABLE `tenancy_rents` (
	`id` text PRIMARY KEY NOT NULL,
	`tenancy_id` text NOT NULL,
	`amount` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenancy_rents_tenancy_idx` ON `tenancy_rents` (`tenancy_id`,`valid_from`);--> statement-breakpoint
-- Each flat's rent periods move to the tenancies they overlap, clipped to
-- each tenancy (openspec: tenancies, "Existing rents move to their
-- tenancies"). A period starting before the tenancy starts on its start day;
-- one running to or past the tenancy's last day has no end. Rent outside
-- every tenancy is not copied. ISO dates compare as text.
INSERT INTO `tenancy_rents` (`id`, `tenancy_id`, `amount`, `valid_from`, `valid_to`)
  SELECT
    lower(hex(randomblob(16))),
    `t`.`id`,
    `r`.`amount`,
    CASE WHEN `r`.`valid_from` > `t`.`valid_from` THEN `r`.`valid_from` ELSE `t`.`valid_from` END,
    CASE
      WHEN `r`.`valid_to` IS NULL THEN NULL
      WHEN `t`.`valid_to` IS NOT NULL AND `r`.`valid_to` >= `t`.`valid_to` THEN NULL
      ELSE `r`.`valid_to`
    END
  FROM `recurring_amounts` AS `r`
  JOIN `tenancies` AS `t` ON `t`.`property_id` = `r`.`property_id`
  WHERE `r`.`kind` = 'rent'
    AND `r`.`valid_from` <= coalesce(`t`.`valid_to`, '9999-12-31')
    AND coalesce(`r`.`valid_to`, '9999-12-31') >= `t`.`valid_from`;--> statement-breakpoint
-- The rent no longer belongs to the flat.
DELETE FROM `recurring_amounts` WHERE `kind` = 'rent';
