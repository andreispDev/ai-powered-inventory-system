ALTER TABLE "category" ADD COLUMN "is_folder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;