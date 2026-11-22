ALTER TABLE `reservation_legs` MODIFY COLUMN `pickup_address` varchar(1000);--> statement-breakpoint
ALTER TABLE `reservation_legs` MODIFY COLUMN `drop_address` varchar(1000);--> statement-breakpoint
ALTER TABLE `reservation_legs` MODIFY COLUMN `flight_no` varchar(50);--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `reference` varchar(40) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `first_name` varchar(150) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `last_name` varchar(150) NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `phone_code` varchar(20);--> statement-breakpoint
ALTER TABLE `reservations` MODIFY COLUMN `phone` varchar(50);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `phone` varchar(50);