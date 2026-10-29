CREATE TABLE `question_attempts` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`question_id` char(26) NOT NULL,
	`course_id` char(26) NOT NULL,
	`is_correct` boolean,
	`response` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `question_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` char(26) NOT NULL,
	`course_id` char(26) NOT NULL,
	`lesson_id` char(26) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`format` enum('mcq','scenario_mcq','multi_select','true_false','fib','saq','laq','why','case') NOT NULL,
	`difficulty` enum('easy','medium','hard'),
	`tags` json NOT NULL,
	`body` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `questions_course_slug_uq` UNIQUE(`course_id`,`slug`)
);
--> statement-breakpoint
ALTER TABLE `question_attempts` ADD CONSTRAINT `question_attempts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_attempts` ADD CONSTRAINT `question_attempts_question_id_questions_id_fk` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `question_attempts` ADD CONSTRAINT `question_attempts_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_lesson_id_lessons_id_fk` FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `question_attempts_user_course_idx` ON `question_attempts` (`user_id`,`course_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `question_attempts_question_idx` ON `question_attempts` (`question_id`);--> statement-breakpoint
CREATE INDEX `questions_lesson_idx` ON `questions` (`lesson_id`);