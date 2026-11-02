CREATE TYPE "public"."category_kind" AS ENUM('stock', 'records');--> statement-breakpoint
ALTER TABLE "category" ADD COLUMN "kind" "category_kind" DEFAULT 'stock' NOT NULL;