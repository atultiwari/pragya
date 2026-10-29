-- Hand-ordered (see D-019):
-- 1. slugs are added nullable, backfilled from the row id, then made NOT NULL, so the new
--    unique keys cannot collide on rows that already exist;
-- 2. replacement indexes are created before the old unique ones are dropped, because MySQL
--    refuses to drop an index that a foreign key (course_id / module_id) is using.
ALTER TABLE `courses` ADD `content_version` varchar(20);--> statement-breakpoint
ALTER TABLE `courses` ADD `content_checksum` char(64);--> statement-breakpoint
ALTER TABLE `lessons` ADD `slug` varchar(80);--> statement-breakpoint
ALTER TABLE `modules` ADD `slug` varchar(80);--> statement-breakpoint
UPDATE `lessons` SET `slug` = CONCAT('legacy-', LOWER(`id`)) WHERE `slug` IS NULL;--> statement-breakpoint
UPDATE `modules` SET `slug` = CONCAT('legacy-', LOWER(`id`)) WHERE `slug` IS NULL;--> statement-breakpoint
ALTER TABLE `lessons` MODIFY `slug` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `modules` MODIFY `slug` varchar(80) NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_course_slug_uq` UNIQUE(`course_id`,`slug`);--> statement-breakpoint
ALTER TABLE `modules` ADD CONSTRAINT `modules_course_slug_uq` UNIQUE(`course_id`,`slug`);--> statement-breakpoint
CREATE INDEX `lessons_module_position_idx` ON `lessons` (`module_id`,`position`);--> statement-breakpoint
CREATE INDEX `modules_course_position_idx` ON `modules` (`course_id`,`position`);--> statement-breakpoint
ALTER TABLE `lessons` DROP INDEX `lessons_module_position_uq`;--> statement-breakpoint
ALTER TABLE `modules` DROP INDEX `modules_course_position_uq`;
