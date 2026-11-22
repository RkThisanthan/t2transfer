CREATE TABLE `api_clients` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`site` enum('t2transfer','t2traslados','pap','pdshuttle') NOT NULL,
	`key_prefix` varchar(12) NOT NULL,
	`key_hash` char(64) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_used_at` datetime,
	`created_by` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `api_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_clients_key_hash_unique` UNIQUE(`key_hash`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned,
	`api_client_id` int unsigned,
	`action` enum('create','update','delete','restore') NOT NULL,
	`auditable_type` varchar(60) NOT NULL,
	`auditable_id` varchar(60) NOT NULL,
	`old_values` json,
	`new_values` json,
	`ip` varchar(45),
	`user_agent` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`api_client_id` int unsigned NOT NULL,
	`key` varchar(100) NOT NULL,
	`request_hash` char(64) NOT NULL,
	`response_status` int NOT NULL,
	`response_body` json NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `idempotency_keys_api_client_id_key_pk` PRIMARY KEY(`api_client_id`,`key`)
);
--> statement-breakpoint
CREATE TABLE `location_types` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 100,
	`legacy_id` int,
	CONSTRAINT `location_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(190) NOT NULL,
	`location_type_id` int unsigned NOT NULL,
	`sort_order` int NOT NULL DEFAULT 10000,
	`is_active` boolean NOT NULL DEFAULT true,
	`legacy_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_legacy_unique` UNIQUE(`legacy_id`)
);
--> statement-breakpoint
CREATE TABLE `phone_country_codes` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`country` varchar(120) NOT NULL,
	`code` varchar(12) NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	CONSTRAINT `phone_country_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reference_counters` (
	`day` char(6) NOT NULL,
	`last_value` int NOT NULL DEFAULT 0,
	CONSTRAINT `reference_counters_day` PRIMARY KEY(`day`)
);
--> statement-breakpoint
CREATE TABLE `reservation_legs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reservation_id` bigint unsigned NOT NULL,
	`kind` enum('arrival','departure','single') NOT NULL,
	`pickup_location_id` int unsigned,
	`pickup_address` varchar(500),
	`drop_location_id` int unsigned,
	`drop_address` varchar(500),
	`pickup_at` datetime,
	`flight_no` varchar(30),
	`flight_city` varchar(100),
	`flight_at` datetime,
	`rate` decimal(10,2) NOT NULL DEFAULT 0,
	`night_charge` decimal(10,2) NOT NULL DEFAULT 0,
	`status` enum('pending','confirmed') NOT NULL DEFAULT 'pending',
	CONSTRAINT `reservation_legs_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservation_legs_kind_unique` UNIQUE(`reservation_id`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`reference` varchar(30) NOT NULL,
	`site` enum('t2transfer','t2traslados','pap','pdshuttle') NOT NULL,
	`source` enum('admin','api','legacy') NOT NULL,
	`trip_type` enum('arrival','departure','arrival_departure','single') NOT NULL,
	`status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
	`title` varchar(10),
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`email` varchar(190) NOT NULL,
	`phone_code` varchar(12),
	`phone` varchar(40),
	`adults` int NOT NULL DEFAULT 1,
	`children` int NOT NULL DEFAULT 0,
	`babies` int NOT NULL DEFAULT 0,
	`luggage_small` int NOT NULL DEFAULT 0,
	`luggage_large` int NOT NULL DEFAULT 0,
	`luggage_xl` int NOT NULL DEFAULT 0,
	`trolleys` int NOT NULL DEFAULT 0,
	`vehicle_class` enum('economy','business') NOT NULL DEFAULT 'economy',
	`upgrade_cost` decimal(10,2) NOT NULL DEFAULT 0,
	`voucher_code` varchar(60),
	`discount` decimal(10,2) NOT NULL DEFAULT 0,
	`total` decimal(10,2) NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'EUR',
	`payment_method` enum('cash','card','online','bank'),
	`payment_status` enum('unpaid','paid') NOT NULL DEFAULT 'unpaid',
	`client_comments` text,
	`special_notes` text,
	`utm_source` varchar(100),
	`utm_medium` varchar(100),
	`legacy_id` int,
	`api_client_id` int unsigned,
	`created_by` bigint unsigned,
	`updated_by` bigint unsigned,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`deleted_at` datetime,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservations_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `api_clients` ADD CONSTRAINT `api_clients_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_api_client_id_api_clients_id_fk` FOREIGN KEY (`api_client_id`) REFERENCES `api_clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD CONSTRAINT `idempotency_keys_api_client_id_api_clients_id_fk` FOREIGN KEY (`api_client_id`) REFERENCES `api_clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `locations` ADD CONSTRAINT `locations_location_type_id_location_types_id_fk` FOREIGN KEY (`location_type_id`) REFERENCES `location_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_legs` ADD CONSTRAINT `reservation_legs_reservation_id_reservations_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_legs` ADD CONSTRAINT `reservation_legs_pickup_location_id_locations_id_fk` FOREIGN KEY (`pickup_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservation_legs` ADD CONSTRAINT `reservation_legs_drop_location_id_locations_id_fk` FOREIGN KEY (`drop_location_id`) REFERENCES `locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reservations` ADD CONSTRAINT `reservations_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_record_idx` ON `audit_logs` (`auditable_type`,`auditable_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `locations_type_idx` ON `locations` (`location_type_id`);--> statement-breakpoint
CREATE INDEX `reservation_legs_pickup_at_idx` ON `reservation_legs` (`pickup_at`);--> statement-breakpoint
CREATE INDEX `reservation_legs_flight_at_idx` ON `reservation_legs` (`flight_at`);--> statement-breakpoint
CREATE INDEX `reservations_created_idx` ON `reservations` (`created_at`);--> statement-breakpoint
CREATE INDEX `reservations_status_idx` ON `reservations` (`status`);--> statement-breakpoint
CREATE INDEX `reservations_email_idx` ON `reservations` (`email`);--> statement-breakpoint
CREATE INDEX `reservations_legacy_idx` ON `reservations` (`legacy_id`);