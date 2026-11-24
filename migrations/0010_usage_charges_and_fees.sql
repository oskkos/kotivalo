CREATE TABLE `tenancy_occupants` (
	`id` text PRIMARY KEY NOT NULL,
	`tenancy_id` text NOT NULL,
	`persons` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenancy_occupants_tenancy_idx` ON `tenancy_occupants` (`tenancy_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `tenant_fee_amounts` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_fee_id` text NOT NULL,
	`amount` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`tenant_fee_id`) REFERENCES `tenant_fees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_fee_amounts_fee_idx` ON `tenant_fee_amounts` (`tenant_fee_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `tenant_fees` (
	`id` text PRIMARY KEY NOT NULL,
	`tenancy_id` text NOT NULL,
	`kind` text NOT NULL,
	`basis` text NOT NULL,
	`description` text,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tenant_fees_tenancy_idx` ON `tenant_fees` (`tenancy_id`);--> statement-breakpoint
CREATE TABLE `usage_charge_amounts` (
	`id` text PRIMARY KEY NOT NULL,
	`usage_charge_id` text NOT NULL,
	`amount` integer NOT NULL,
	`valid_from` text NOT NULL,
	`valid_to` text,
	FOREIGN KEY (`usage_charge_id`) REFERENCES `usage_charges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usage_charge_amounts_charge_idx` ON `usage_charge_amounts` (`usage_charge_id`,`valid_from`);--> statement-breakpoint
CREATE TABLE `usage_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`kind` text NOT NULL,
	`basis` text NOT NULL,
	`description` text,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `usage_charges_property_idx` ON `usage_charges` (`property_id`);
--> statement-breakpoint
-- Every existing tenancy has one occupant from its start (openspec:
-- tenancies, "Existing tenancies get one occupant").
INSERT INTO `tenancy_occupants` (`id`, `tenancy_id`, `persons`, `valid_from`, `valid_to`)
  SELECT lower(hex(randomblob(16))), `id`, 1, `valid_from`, NULL FROM `tenancies`;
