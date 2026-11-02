CREATE TABLE "item_attachment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_attachment" ADD CONSTRAINT "item_attachment_uploaded_by_app_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_attachment" ADD CONSTRAINT "item_attachment_office_id_item_id_item_office_id_id_fk" FOREIGN KEY ("office_id","item_id") REFERENCES "public"."item"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_attachment_item_idx" ON "item_attachment" USING btree ("item_id","created_at" DESC NULLS LAST);