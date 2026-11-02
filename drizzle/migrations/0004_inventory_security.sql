-- Office separation for inventory. Developers can read (platform scope) but only an office can write.
GRANT SELECT, INSERT, UPDATE ON category, category_field, item TO inventory_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON stock_movement TO inventory_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE stock_movement_id_seq TO inventory_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON idempotency_key TO inventory_app;
--> statement-breakpoint

ALTER TABLE category ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE category FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY category_read ON category FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY category_insert ON category FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY category_update ON category FOR UPDATE TO inventory_app USING (office_id = app_office_id()) WITH CHECK (office_id = app_office_id());
--> statement-breakpoint

ALTER TABLE category_field ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE category_field FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY category_field_read ON category_field FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY category_field_insert ON category_field FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY category_field_update ON category_field FOR UPDATE TO inventory_app USING (office_id = app_office_id()) WITH CHECK (office_id = app_office_id());
--> statement-breakpoint

ALTER TABLE item ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE item FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY item_read ON item FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY item_insert ON item FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY item_update ON item FOR UPDATE TO inventory_app USING (office_id = app_office_id()) WITH CHECK (office_id = app_office_id());
--> statement-breakpoint

ALTER TABLE stock_movement ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE stock_movement FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY stock_movement_read ON stock_movement FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY stock_movement_insert ON stock_movement FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE TRIGGER stock_movement_append_only BEFORE UPDATE OR DELETE ON stock_movement
  FOR EACH ROW EXECUTE FUNCTION reject_change();
--> statement-breakpoint
CREATE TRIGGER stock_movement_no_truncate BEFORE TRUNCATE ON stock_movement
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change();
--> statement-breakpoint

-- A person's retry keys are visible only to them.
ALTER TABLE idempotency_key ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE idempotency_key FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY idempotency_key_own ON idempotency_key FOR ALL TO inventory_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
