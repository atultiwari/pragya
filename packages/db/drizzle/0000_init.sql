CREATE TABLE `role_assignments` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`role` enum('superadmin','content_reviewer','finance','support','tutor','nodal_officer','teacher','student') NOT NULL,
	`scope_type` enum('platform','institute','batch','course') NOT NULL,
	`scope_id` varchar(26) NOT NULL DEFAULT '',
	`granted_by` char(26),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `role_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_assignments_uq` UNIQUE(`user_id`,`role`,`scope_type`,`scope_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(26) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`phone` varchar(20),
	`image` varchar(2048),
	`handle` varchar(40),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`),
	CONSTRAINT `users_phone_uq` UNIQUE(`phone`),
	CONSTRAINT `users_handle_uq` UNIQUE(`handle`)
);
--> statement-breakpoint
CREATE TABLE `batch_members` (
	`batch_id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`institute_id` char(26) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `batch_members_batch_id_user_id_pk` PRIMARY KEY(`batch_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` char(26) NOT NULL,
	`institute_id` char(26) NOT NULL,
	`name` varchar(120) NOT NULL,
	`cohort` varchar(60),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `batches_institute_name_uq` UNIQUE(`institute_id`,`name`),
	CONSTRAINT `batches_id_institute_uq` UNIQUE(`id`,`institute_id`)
);
--> statement-breakpoint
CREATE TABLE `institutes` (
	`id` char(26) NOT NULL,
	`name` varchar(200) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`city` varchar(100),
	`state` varchar(100),
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `institutes_id` PRIMARY KEY(`id`),
	CONSTRAINT `institutes_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `course_tutors` (
	`course_id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`revenue_share_pct` decimal(5,2) NOT NULL DEFAULT '100.00',
	`is_lead` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `course_tutors_course_id_user_id_pk` PRIMARY KEY(`course_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` char(26) NOT NULL,
	`stream_id` char(26) NOT NULL,
	`institute_id` char(26),
	`title` varchar(200) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`summary` text,
	`status` enum('draft','in_review','published','archived') NOT NULL DEFAULT 'draft',
	`visibility` enum('public','institute','public_and_institute') NOT NULL DEFAULT 'public',
	`price_paise` int unsigned NOT NULL DEFAULT 0,
	`language` varchar(10) NOT NULL DEFAULT 'en',
	`published_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `courses_id` PRIMARY KEY(`id`),
	CONSTRAINT `courses_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `courses_visibility_institute_ck` CHECK(`courses`.`visibility` = 'public' OR `courses`.`institute_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` char(26) NOT NULL,
	`module_id` char(26) NOT NULL,
	`course_id` char(26) NOT NULL,
	`title` varchar(200) NOT NULL,
	`position` smallint NOT NULL,
	`is_preview` boolean NOT NULL DEFAULT false,
	`blocks` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `lessons_module_position_uq` UNIQUE(`module_id`,`position`)
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`id` char(26) NOT NULL,
	`course_id` char(26) NOT NULL,
	`title` varchar(200) NOT NULL,
	`position` smallint NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `modules_id` PRIMARY KEY(`id`),
	CONSTRAINT `modules_course_position_uq` UNIQUE(`course_id`,`position`),
	CONSTRAINT `modules_id_course_uq` UNIQUE(`id`,`course_id`)
);
--> statement-breakpoint
CREATE TABLE `streams` (
	`id` char(26) NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`sort_order` smallint NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `streams_id` PRIMARY KEY(`id`),
	CONSTRAINT `streams_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` char(26) NOT NULL,
	`user_id` char(26) NOT NULL,
	`course_id` char(26) NOT NULL,
	`source` enum('purchase','institute','unlock_code','free') NOT NULL,
	`institute_id` char(26),
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`expires_at` timestamp(3),
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `enrollments_id` PRIMARY KEY(`id`),
	CONSTRAINT `enrollments_user_course_uq` UNIQUE(`user_id`,`course_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` char(26) NOT NULL,
	`actor_user_id` char(26),
	`action` varchar(60) NOT NULL,
	`target_type` varchar(40) NOT NULL,
	`target_id` varchar(26) NOT NULL,
	`institute_id` char(26),
	`metadata` json,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_assignments` ADD CONSTRAINT `role_assignments_granted_by_users_id_fk` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_members` ADD CONSTRAINT `batch_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_members` ADD CONSTRAINT `batch_members_batch_fk` FOREIGN KEY (`batch_id`,`institute_id`) REFERENCES `batches`(`id`,`institute_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batches` ADD CONSTRAINT `batches_institute_id_institutes_id_fk` FOREIGN KEY (`institute_id`) REFERENCES `institutes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_tutors` ADD CONSTRAINT `course_tutors_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_tutors` ADD CONSTRAINT `course_tutors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_stream_id_streams_id_fk` FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `courses` ADD CONSTRAINT `courses_institute_id_institutes_id_fk` FOREIGN KEY (`institute_id`) REFERENCES `institutes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessons` ADD CONSTRAINT `lessons_module_fk` FOREIGN KEY (`module_id`,`course_id`) REFERENCES `modules`(`id`,`course_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `modules` ADD CONSTRAINT `modules_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_institute_id_institutes_id_fk` FOREIGN KEY (`institute_id`) REFERENCES `institutes`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `role_assignments_scope_idx` ON `role_assignments` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE INDEX `batch_members_institute_idx` ON `batch_members` (`institute_id`);--> statement-breakpoint
CREATE INDEX `course_tutors_user_idx` ON `course_tutors` (`user_id`);--> statement-breakpoint
CREATE INDEX `courses_stream_status_idx` ON `courses` (`stream_id`,`status`);--> statement-breakpoint
CREATE INDEX `courses_institute_idx` ON `courses` (`institute_id`);--> statement-breakpoint
CREATE INDEX `lessons_course_idx` ON `lessons` (`course_id`);--> statement-breakpoint
CREATE INDEX `enrollments_course_idx` ON `enrollments` (`course_id`);--> statement-breakpoint
CREATE INDEX `enrollments_institute_idx` ON `enrollments` (`institute_id`);--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `audit_log_institute_idx` ON `audit_log` (`institute_id`,`created_at`);