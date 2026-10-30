CREATE TABLE `lesson_progress` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`lesson_id` char(26) NOT NULL,
	`course_id` char(26) NOT NULL,
	`completed_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lesson_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `lesson_progress_user_lesson_uq` UNIQUE(`user_id`,`lesson_id`)
);--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_id_course_uq` UNIQUE(`id`,`course_id`);--> statement-breakpoint
CREATE INDEX `lesson_progress_user_course_idx` ON `lesson_progress` (`user_id`,`course_id`,`completed_at`);--> statement-breakpoint
CREATE INDEX `lesson_progress_lesson_course_idx` ON `lesson_progress` (`lesson_id`,`course_id`);--> statement-breakpoint
CREATE INDEX `lesson_progress_course_idx` ON `lesson_progress` (`course_id`);--> statement-breakpoint
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lesson_progress` ADD CONSTRAINT `lesson_progress_lesson_fk` FOREIGN KEY (`lesson_id`,`course_id`) REFERENCES `lessons`(`id`,`course_id`) ON DELETE cascade ON UPDATE no action;
