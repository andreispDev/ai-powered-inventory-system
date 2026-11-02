ALTER TABLE "category" ADD COLUMN "disabled_fields" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "item" DROP COLUMN "reorder_level";