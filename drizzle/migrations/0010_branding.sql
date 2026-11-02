CREATE TABLE "office_branding" (
	"office_id" uuid PRIMARY KEY NOT NULL,
	"workspace_name" text,
	"logo" "bytea",
	"logo_type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_avatar" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"office_id" uuid,
	"image" "bytea" NOT NULL,
	"image_type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "office_branding" ADD CONSTRAINT "office_branding_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;