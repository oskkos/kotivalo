CREATE TABLE `deposit_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`tenancy_id` text NOT NULL,
	`returned_on` text NOT NULL,
	`rent_kept` integer NOT NULL,
	`damage_kept` integer NOT NULL,
	`note` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`tenancy_id`) REFERENCES `tenancies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deposit_returns_tenancy_id_unique` ON `deposit_returns` (`tenancy_id`);--> statement-breakpoint
ALTER TABLE `rent_payments` ADD `deposit_return_id` text REFERENCES deposit_returns(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `tenancies` ADD `deposit` integer;