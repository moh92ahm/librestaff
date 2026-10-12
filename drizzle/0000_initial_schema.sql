CREATE TYPE "public"."employment_type" AS ENUM('citizen', 'workPermit', 'other');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('employee', 'contractor', 'consultant', 'external', 'serviceAccount');--> statement-breakpoint
CREATE TYPE "public"."application_source" AS ENUM('website', 'linkedin', 'referral', 'job-board', 'other');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('new', 'under-review', 'shortlisted', 'interview-scheduled', 'rejected', 'hired');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('high-school', 'associate', 'bachelor', 'master', 'phd', 'other');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('employed', 'unemployed', 'notice-period', 'student');--> statement-breakpoint
CREATE TYPE "public"."inventory_log_event" AS ENUM('created', 'holderChanged', 'statusChanged');--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('inUse', 'inStock', 'needsRepair', 'underRepair');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('laptop', 'phone', 'accessory', 'simCard', 'other');--> statement-breakpoint
CREATE TYPE "public"."leave_status" AS ENUM('requested', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."leave_type" AS ENUM('annual', 'sick', 'unpaid', 'other');--> statement-breakpoint
CREATE TYPE "public"."announcement_channel_visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'sent', 'archived');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'new', 'held', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."notification_email_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."notification_outbox_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_source_type" AS ENUM('announcement', 'event');--> statement-breakpoint
CREATE TYPE "public"."communication_target_type" AS ENUM('everyone', 'departments', 'users');--> statement-breakpoint
CREATE TYPE "public"."payment_frequency" AS ENUM('monthly', 'quarterly', 'annual', 'oneTime');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bankTransfer', 'cash', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."payroll_type" AS ENUM('primary', 'bonus', 'overtime', 'commission', 'allowance', 'other');--> statement-breakpoint
CREATE TYPE "public"."additional_payment_category" AS ENUM('bonus', 'advance', 'commission', 'allowance', 'other');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('generated', 'approved', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_billing_cycle" AS ENUM('monthly', 'quarterly', 'sixMonthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."expense_payment_method" AS ENUM('bankTransfer', 'cash', 'cheque', 'creditCard', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_payment_source" AS ENUM('single', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."expense_payment_status" AS ENUM('generated', 'approved', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('oneTime', 'recurring');--> statement-breakpoint
CREATE TABLE "user_dotted_managers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"manager_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "user_dotted_managers_user_manager_unique" UNIQUE("user_id","manager_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(255),
	"password" text,
	"email_verified" text,
	"full_name" varchar(255) NOT NULL,
	"photo" text,
	"birth_date" text,
	"primary_phone" varchar(50),
	"secondary_phone" varchar(50),
	"secondary_email" varchar(255),
	"address" text,
	"job_title" varchar(255),
	"employment_type" "employment_type" DEFAULT 'other' NOT NULL,
	"nationality" varchar(100),
	"identity_number" varchar(100),
	"employment_start_date" text,
	"employment_note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_protected_admin" boolean DEFAULT false NOT NULL,
	"person_type" "person_type" DEFAULT 'employee' NOT NULL,
	"include_in_headcount" boolean DEFAULT true NOT NULL,
	"visible_in_team_directory" boolean DEFAULT true NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"theme" text DEFAULT 'light' NOT NULL,
	"role_id" text,
	"department_id" text,
	"documents" json DEFAULT '[]'::json,
	"joined_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_secondary_email_unique" UNIQUE("secondary_email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" text,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" text NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" text NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"scope" varchar(50) NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "role_permissions_role_resource_action_unique" UNIQUE("role_id","resource","action")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"role_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"used_at" text,
	"invited_by" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "user_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"parent_department_id" text,
	"manager_user_id" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "applicants" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"linkedin_url" text,
	"portfolio_url" text,
	"position_applied_for" varchar(255) NOT NULL,
	"years_of_experience" integer NOT NULL,
	"education_level" "education_level" NOT NULL,
	"current_employment_status" "employment_status" DEFAULT 'unemployed' NOT NULL,
	"expected_salary" integer,
	"availability_date" text,
	"source" "application_source",
	"bio" text NOT NULL,
	"cv" text NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"application_date" text NOT NULL,
	"internal_notes" text,
	"consent_to_data_storage" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "applicants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "inventory_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_id" text NOT NULL,
	"event_type" "inventory_log_event" NOT NULL,
	"old_value" text,
	"new_value" text,
	"old_label" text,
	"new_label" text,
	"actor_user_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"item_type" "item_type" DEFAULT 'other' NOT NULL,
	"model" varchar(255) NOT NULL,
	"serial_number" varchar(255) NOT NULL,
	"holder_id" text,
	"status" "inventory_status" DEFAULT 'inStock' NOT NULL,
	"purchase_date" text,
	"warranty_expiry" text,
	"images" json DEFAULT '[]'::json,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "inventory_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "leave_entitlement_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"minimum_service_months" integer NOT NULL,
	"days" integer NOT NULL,
	"label" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_policy_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"carryover_limit_days" integer,
	"count_saturday" boolean DEFAULT true NOT NULL,
	"count_sunday" boolean DEFAULT false NOT NULL,
	"count_holidays" boolean DEFAULT true NOT NULL,
	"allow_negative_balance" boolean DEFAULT true NOT NULL,
	"unpaid_leave_deduction_enabled" boolean DEFAULT true NOT NULL,
	"unpaid_leave_deduction_daily_rate_basis" varchar(32) DEFAULT 'workingDays' NOT NULL,
	"unpaid_leave_deduction_day_basis" varchar(32) DEFAULT 'leavePolicy' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_days" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "leave_type" NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"total_days" integer,
	"auto_calculated_days" integer,
	"is_manual_day_count" boolean DEFAULT false NOT NULL,
	"manual_day_count_reason" text,
	"status" "leave_status" DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"attachments" json DEFAULT '[]'::json NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255),
	"mime_type" varchar(100) NOT NULL,
	"filesize" integer NOT NULL,
	"width" integer,
	"height" integer,
	"storage_key" text,
	"visibility" varchar(20) DEFAULT 'public' NOT NULL,
	"alt" text,
	"url" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_user_id" text NOT NULL,
	"actor_user_id" text,
	"event_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_label" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_key" text,
	"created_at" text NOT NULL,
	CONSTRAINT "member_activity_logs_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"logo_url" text NOT NULL,
	"website" text,
	"company_email" varchar(255),
	"phone" varchar(100),
	"country" varchar(100),
	"address" text,
	"tax_registration_number" varchar(255),
	"default_timezone" varchar(100) NOT NULL,
	"working_week" json NOT NULL,
	"holiday_countries" json NOT NULL,
	"enabled_languages" json NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"from_name" varchar(255) NOT NULL,
	"from_email" varchar(255) NOT NULL,
	"reply_to_email" varchar(255),
	"smtp_host" varchar(255) NOT NULL,
	"smtp_port" integer DEFAULT 587 NOT NULL,
	"secure_mode" varchar(20) DEFAULT 'starttls' NOT NULL,
	"auth_mode" varchar(20) DEFAULT 'none' NOT NULL,
	"encrypted_smtp_username" text,
	"encrypted_smtp_password" text,
	"last_test_at" text,
	"last_test_status" varchar(20),
	"last_test_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"schedule_type" varchar(20) NOT NULL,
	"daily_time" varchar(5),
	"monthly_day" integer,
	"monthly_time" varchar(5),
	"interval_minutes" integer,
	"timezone" varchar(100) NOT NULL,
	"auto_run_outbox" boolean DEFAULT false NOT NULL,
	"last_run_at" text,
	"last_run_key" text,
	"last_status" varchar(20),
	"last_result" jsonb,
	"last_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"media_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6366f1' NOT NULL,
	"visibility" "announcement_channel_visibility" DEFAULT 'public' NOT NULL,
	"created_by_id" text,
	"notify_in_app" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_channel_department_members" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"department_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_channel_user_members" (
	"id" text PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_comment_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"media_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_comment_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "announcement_comment_reactions_comment_id_user_id_emoji_unique" UNIQUE("comment_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "announcement_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_department_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"department_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(255) NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "announcement_mentions_announcement_user_unique" UNIQUE("announcement_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "announcement_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"user_id" text NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "announcement_reactions_announcement_id_user_id_emoji_unique" UNIQUE("announcement_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "announcement_user_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"status" "announcement_status" DEFAULT 'draft' NOT NULL,
	"target_type" "communication_target_type" DEFAULT 'everyone' NOT NULL,
	"created_by_id" text NOT NULL,
	"category_id" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"event_id" text,
	"sent_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_department_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"department_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_user_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "event_status" DEFAULT 'new' NOT NULL,
	"target_type" "communication_target_type" DEFAULT 'everyone' NOT NULL,
	"start_at" text NOT NULL,
	"end_at" text NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" varchar(100) DEFAULT 'UTC' NOT NULL,
	"location" varchar(255),
	"created_by_id" text NOT NULL,
	"announcement_id" text,
	"notify_in_app" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT false NOT NULL,
	"published_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_email_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"status" "notification_email_status" DEFAULT 'pending' NOT NULL,
	"sent_at" text,
	"error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_event_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" varchar(120) NOT NULL,
	"source_type" varchar(80) NOT NULL,
	"source_id" text NOT NULL,
	"source_key" text NOT NULL,
	"actor_user_id" text,
	"recipients" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"delivery" jsonb NOT NULL,
	"status" "notification_outbox_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" text,
	"processed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "notification_event_outbox_source_key_unique" UNIQUE("source_key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_user_id" text NOT NULL,
	"event_type" varchar(120) DEFAULT 'legacy.notification' NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"actor_user_id" text,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"link_url" text NOT NULL,
	"metadata" jsonb,
	"read_at" text,
	"seen_at" text,
	"archived_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_action_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_run_id" text NOT NULL,
	"action_index" integer NOT NULL,
	"action_type" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" text NOT NULL,
	"finished_at" text
);
--> statement-breakpoint
CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workflow_id" text NOT NULL,
	"source_event_id" text NOT NULL,
	"source_type" varchar(80) NOT NULL,
	"source_id" text NOT NULL,
	"status" varchar(32) DEFAULT 'running' NOT NULL,
	"condition_results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" text NOT NULL,
	"finished_at" text,
	CONSTRAINT "workflow_runs_workflow_source_unique" UNIQUE("workflow_id","source_event_id")
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger_type" varchar(120) NOT NULL,
	"trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"payroll_type" "payroll_type" DEFAULT 'primary' NOT NULL,
	"description" text,
	"amount" numeric(10, 2) NOT NULL,
	"payment_type" "payment_method" DEFAULT 'bankTransfer' NOT NULL,
	"payment_frequency" "payment_frequency" DEFAULT 'monthly' NOT NULL,
	"bank_account" json,
	"is_active" boolean DEFAULT true NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "additional_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"category" "additional_payment_category" DEFAULT 'bonus' NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"payment_type" "payment_method" DEFAULT 'bankTransfer' NOT NULL,
	"month" varchar(2) NOT NULL,
	"year" integer NOT NULL,
	"status" "payroll_status" DEFAULT 'generated' NOT NULL,
	"notes" text,
	"payment_date" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"month" varchar(2) NOT NULL,
	"year" integer NOT NULL,
	"payroll_items" json DEFAULT '[]'::json,
	"bonus_amount" numeric(10, 2) DEFAULT '0',
	"deduction_amount" numeric(10, 2) DEFAULT '0',
	"adjustment_note" text,
	"total_amount" numeric(10, 2) NOT NULL,
	"payment_date" text,
	"payment_reference" text,
	"payment_notes" text,
	"status" "payroll_status" DEFAULT 'generated' NOT NULL,
	"processed_by_id" text,
	"processed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text,
	"type" "expense_type" NOT NULL,
	"source" "expense_payment_source" DEFAULT 'single' NOT NULL,
	"status" "expense_payment_status" DEFAULT 'generated' NOT NULL,
	"expense_month" varchar(2) NOT NULL,
	"expense_year" integer NOT NULL,
	"generation_date" text NOT NULL,
	"due_date" text NOT NULL,
	"payment_date" text,
	"name" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" varchar(100) NOT NULL,
	"vendor" varchar(255),
	"payment_method" "expense_payment_method" DEFAULT 'bankTransfer' NOT NULL,
	"is_reimbursable" boolean DEFAULT false NOT NULL,
	"reimbursable_employee_id" text,
	"notes" text,
	"documents" json DEFAULT '[]'::json,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "expense_type" DEFAULT 'recurring' NOT NULL,
	"name" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" varchar(100) NOT NULL,
	"vendor" varchar(255),
	"payment_method" "expense_payment_method" DEFAULT 'bankTransfer' NOT NULL,
	"is_reimbursable" boolean DEFAULT false NOT NULL,
	"reimbursable_employee_id" text,
	"notes" text,
	"billing_cycle" "expense_billing_cycle",
	"recurring_day" integer,
	"recurring_month" integer,
	"due_offset_days" integer DEFAULT 7 NOT NULL,
	"start_date" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_invites_email_idx" ON "user_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_activity_logs_subject_created_idx" ON "member_activity_logs" USING btree ("subject_user_id","created_at");--> statement-breakpoint
CREATE INDEX "member_activity_logs_source_idx" ON "member_activity_logs" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "announcement_mentions_announcement_idx" ON "announcement_mentions" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "notification_event_outbox_dispatch_idx" ON "notification_event_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_event_outbox_source_idx" ON "notification_event_outbox" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "workflow_action_runs_run_idx" ON "workflow_action_runs" USING btree ("workflow_run_id","action_index");--> statement-breakpoint
CREATE INDEX "workflow_runs_workflow_idx" ON "workflow_runs" USING btree ("workflow_id","started_at");--> statement-breakpoint
CREATE INDEX "workflow_runs_source_idx" ON "workflow_runs" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "workflows_trigger_enabled_idx" ON "workflows" USING btree ("trigger_type","enabled");--> statement-breakpoint
CREATE INDEX "workflows_updated_idx" ON "workflows" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_payments_recurring_period_unique" ON "expense_payments" USING btree ("expense_id","expense_month","expense_year") WHERE "expense_payments"."expense_id" IS NOT NULL;