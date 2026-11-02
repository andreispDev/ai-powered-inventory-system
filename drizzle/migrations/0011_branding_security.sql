-- An office manages its own branding. Each person manages their own photo.
GRANT SELECT, INSERT, UPDATE ON office_branding TO inventory_app;
--> statement-breakpoint
ALTER TABLE office_branding ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE office_branding FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY office_branding_read ON office_branding FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY office_branding_insert ON office_branding FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY office_branding_update ON office_branding FOR UPDATE TO inventory_app USING (office_id = app_office_id()) WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
GRANT SELECT (office_id, workspace_name, logo_type, updated_at) ON office_branding TO inventory_auth;
--> statement-breakpoint
CREATE POLICY office_branding_auth ON office_branding FOR SELECT TO inventory_auth USING (true);
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON user_avatar TO inventory_app;
--> statement-breakpoint
ALTER TABLE user_avatar ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE user_avatar FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY user_avatar_read ON user_avatar FOR SELECT TO inventory_app
  USING (office_id = app_office_id() OR user_id = app_user_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY user_avatar_insert ON user_avatar FOR INSERT TO inventory_app
  WITH CHECK (user_id = app_user_id() AND office_id IS NOT DISTINCT FROM app_office_id());
--> statement-breakpoint
CREATE POLICY user_avatar_update ON user_avatar FOR UPDATE TO inventory_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id() AND office_id IS NOT DISTINCT FROM app_office_id());
--> statement-breakpoint
CREATE POLICY user_avatar_delete ON user_avatar FOR DELETE TO inventory_app USING (user_id = app_user_id());
--> statement-breakpoint
GRANT SELECT (user_id, updated_at) ON user_avatar TO inventory_auth;
--> statement-breakpoint
CREATE POLICY user_avatar_auth ON user_avatar FOR SELECT TO inventory_auth USING (true);
