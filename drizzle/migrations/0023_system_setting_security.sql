-- One row, holding settings for the whole system. Everyone reads it, and only platform accounts change it.
INSERT INTO system_setting (id) VALUES (1);
--> statement-breakpoint
GRANT SELECT, UPDATE ON system_setting TO inventory_app;
--> statement-breakpoint
GRANT SELECT ON system_setting TO inventory_auth;
--> statement-breakpoint
ALTER TABLE system_setting ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE system_setting FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY system_setting_read ON system_setting FOR SELECT TO inventory_app, inventory_auth USING (true);
--> statement-breakpoint
CREATE POLICY system_setting_update ON system_setting FOR UPDATE TO inventory_app USING (app_is_platform()) WITH CHECK (app_is_platform());
