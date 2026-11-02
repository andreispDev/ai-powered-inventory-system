CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_out';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_in';--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid,
	"audience_type" text NOT NULL,
	"audience_office_ids" uuid[],
	"audience_role" "role",
	"title" text NOT NULL,
	"body" text NOT NULL,
	"urgent" boolean DEFAULT false NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"assignee_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"since" date NOT NULL,
	"due_at" date,
	"returned_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_checkpoint" (
	"up_to_id" bigint PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"queue" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"duration_ms" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"urgent" boolean DEFAULT false NOT NULL,
	"announcement_id" uuid,
	"dedupe_key" text NOT NULL,
	"read_at" timestamp with time zone,
	"acked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_office_id" uuid NOT NULL,
	"to_office_id" uuid NOT NULL,
	"from_office_name" text NOT NULL,
	"to_office_name" text NOT NULL,
	"item_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"item_sku" text,
	"unit" text NOT NULL,
	"quantity" integer NOT NULL,
	"status" "transfer_status" DEFAULT 'pending' NOT NULL,
	"note" text,
	"requested_by" uuid NOT NULL,
	"requested_by_name" text NOT NULL,
	"responded_by_name" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_quantity_positive" CHECK ("transfer"."quantity" > 0),
	CONSTRAINT "transfer_two_offices" CHECK ("transfer"."from_office_id" <> "transfer"."to_office_id")
);
--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_assignee_id_app_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_assigned_by_app_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_office_id_item_id_item_office_id_id_fk" FOREIGN KEY ("office_id","item_id") REFERENCES "public"."item"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_announcement_id_announcement_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcement"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_from_office_id_office_id_fk" FOREIGN KEY ("from_office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_to_office_id_office_id_fk" FOREIGN KEY ("to_office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_requested_by_app_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcement_due_idx" ON "announcement" USING btree ("scheduled_at") WHERE "announcement"."sent_at" IS NULL;--> statement-breakpoint
CREATE INDEX "assignment_item_idx" ON "assignment" USING btree ("office_id","item_id");--> statement-breakpoint
CREATE INDEX "assignment_open_idx" ON "assignment" USING btree ("office_id","due_at") WHERE "assignment"."returned_at" IS NULL;--> statement-breakpoint
CREATE INDEX "job_run_at_idx" ON "job_run" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "notification_once_idx" ON "notification" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transfer_from_idx" ON "transfer" USING btree ("from_office_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "transfer_to_idx" ON "transfer" USING btree ("to_office_id","created_at" DESC NULLS LAST);