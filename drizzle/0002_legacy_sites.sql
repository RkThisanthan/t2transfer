ALTER TABLE `api_clients` MODIFY COLUMN `site` varchar(12) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `site` varchar(12) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservation_legs` DROP COLUMN `status`;