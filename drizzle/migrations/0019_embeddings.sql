CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "item_embedding" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"office_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_embedding" ADD CONSTRAINT "item_embedding_office_id_item_id_item_office_id_id_fk" FOREIGN KEY ("office_id","item_id") REFERENCES "public"."item"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_embedding_office_idx" ON "item_embedding" USING btree ("office_id");