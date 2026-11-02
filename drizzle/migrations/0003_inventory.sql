CREATE TYPE "public"."item_status" AS ENUM('active', 'in_repair', 'retired', 'lost');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('receive', 'issue', 'adjust', 'return');--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_office_id_uq" UNIQUE("office_id","id")
);
--> statement-breakpoint
CREATE TABLE "category_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"status" "item_status" DEFAULT 'active' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'pcs' NOT NULL,
	"location" text,
	"condition" text,
	"serial_number" text,
	"supplier" text,
	"unit_cost" numeric(14, 2),
	"purchase_date" date,
	"warranty_expiry" date,
	"reorder_level" integer,
	"notes" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(serial_number, '') || ' ' || coalesce(notes, ''))) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_office_id_uq" UNIQUE("office_id","id"),
	CONSTRAINT "item_quantity_not_negative" CHECK ("item"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"office_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"type" "movement_type" NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "preferences" jsonb;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_office_id_parent_id_category_office_id_id_fk" FOREIGN KEY ("office_id","parent_id") REFERENCES "public"."category"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_field" ADD CONSTRAINT "category_field_office_id_category_id_category_office_id_id_fk" FOREIGN KEY ("office_id","category_id") REFERENCES "public"."category"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_key" ADD CONSTRAINT "idempotency_key_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_office_id_category_id_category_office_id_id_fk" FOREIGN KEY ("office_id","category_id") REFERENCES "public"."category"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_actor_id_app_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_office_id_item_id_item_office_id_id_fk" FOREIGN KEY ("office_id","item_id") REFERENCES "public"."item"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_office_parent_name_idx" ON "category" USING btree ("office_id","parent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "category_field_key_idx" ON "category_field" USING btree ("category_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_key_idx" ON "idempotency_key" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "item_office_sku_idx" ON "item" USING btree ("office_id","sku") WHERE "item"."sku" IS NOT NULL AND "item"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "item_office_category_idx" ON "item" USING btree ("office_id","category_id");--> statement-breakpoint
CREATE INDEX "item_office_name_idx" ON "item" USING btree ("office_id","name");--> statement-breakpoint
CREATE INDEX "item_search_idx" ON "item" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "item_attributes_idx" ON "item" USING gin ("attributes" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "stock_movement_item_idx" ON "stock_movement" USING btree ("office_id","item_id","occurred_at" DESC NULLS LAST);