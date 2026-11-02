CREATE TYPE "public"."grant_effect" AS ENUM('allow', 'deny');--> statement-breakpoint
CREATE TYPE "public"."grant_subject" AS ENUM('user', 'office');--> statement-breakpoint
CREATE TYPE "public"."office_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('developer', 'admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'deactivated');--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" "role" NOT NULL,
	"office_id" uuid,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_user_email_unique" UNIQUE("email"),
	CONSTRAINT "app_user_role_office" CHECK (("app_user"."role" = 'developer' AND "app_user"."office_id" IS NULL) OR ("app_user"."role" <> 'developer' AND "app_user"."office_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"office_id" uuid,
	"actor_id" uuid,
	"actor_role" "role",
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"contact_email" text,
	"status" "office_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"office_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "permission_grant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_type" "grant_subject" NOT NULL,
	"subject_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"permission" text NOT NULL,
	"effect" "grant_effect" NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_grant" ADD CONSTRAINT "permission_grant_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_grant" ADD CONSTRAINT "permission_grant_granted_by_app_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_user_provider_idx" ON "account" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "app_user_office_idx" ON "app_user" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "audit_log_office_at_idx" ON "audit_log" USING btree ("office_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_at_idx" ON "audit_log" USING btree ("actor_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "outbox_unpublished_idx" ON "outbox" USING btree ("created_at") WHERE "outbox"."published_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "permission_grant_subject_idx" ON "permission_grant" USING btree ("subject_type","subject_id","permission");--> statement-breakpoint
CREATE INDEX "permission_grant_office_idx" ON "permission_grant" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");