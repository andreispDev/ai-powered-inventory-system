-- People read their own office's forecasts. Only the worker writes them.
GRANT SELECT, INSERT, UPDATE ON forecast TO inventory_app;
--> statement-breakpoint
ALTER TABLE forecast ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE forecast FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY forecast_read ON forecast FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY forecast_insert ON forecast FOR INSERT TO inventory_app WITH CHECK (current_setting('app.worker', true) = 'on');
--> statement-breakpoint
CREATE POLICY forecast_update ON forecast FOR UPDATE TO inventory_app
  USING (current_setting('app.worker', true) = 'on') WITH CHECK (current_setting('app.worker', true) = 'on');
