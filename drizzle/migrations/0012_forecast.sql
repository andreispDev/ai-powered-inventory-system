CREATE TABLE "forecast" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"office_id" uuid NOT NULL,
	"state" text NOT NULL,
	"method" text,
	"weekly_demand" double precision,
	"weekly_low" double precision,
	"weekly_high" double precision,
	"stockout_at" date,
	"stockout_earliest" date,
	"stockout_latest" date,
	"reorder_quantity" integer,
	"reorder_by" date,
	"confidence" text,
	"backtest_error" double precision,
	"baseline_error" double precision,
	"reason" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forecast" ADD CONSTRAINT "forecast_office_id_item_id_item_office_id_id_fk" FOREIGN KEY ("office_id","item_id") REFERENCES "public"."item"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "forecast_office_stockout_idx" ON "forecast" USING btree ("office_id","stockout_at");