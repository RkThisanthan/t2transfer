ALTER TABLE `reservation_legs` ADD `vat_rate` decimal(5,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Hand-added: convert the first site names to the legacy site codes.
UPDATE `reservations` SET `site` = CASE `site` WHEN 't2transfer' THEN 'T2' WHEN 't2traslados' THEN 'T2ES' WHEN 'pap' THEN 'PAP' WHEN 'pdshuttle' THEN 'PD' ELSE `site` END;--> statement-breakpoint
UPDATE `api_clients` SET `site` = CASE `site` WHEN 't2transfer' THEN 'T2' WHEN 't2traslados' THEN 'T2ES' WHEN 'pap' THEN 'PAP' WHEN 'pdshuttle' THEN 'PD' ELSE `site` END;
