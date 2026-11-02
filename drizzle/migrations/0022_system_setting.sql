CREATE TABLE "system_setting" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"idle_minutes" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_setting_one_row" CHECK ("system_setting"."id" = 1),
	CONSTRAINT "system_setting_idle_range" CHECK ("system_setting"."idle_minutes" between 1 and 480)
);
