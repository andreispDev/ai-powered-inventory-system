-- People see their own requests. Only Developers decide them.
GRANT SELECT, INSERT, UPDATE ON permission_request TO inventory_app;
--> statement-breakpoint
ALTER TABLE permission_request ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE permission_request FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY permission_request_read ON permission_request FOR SELECT TO inventory_app
  USING (requester_id = app_user_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY permission_request_insert ON permission_request FOR INSERT TO inventory_app
  WITH CHECK (requester_id = app_user_id() AND office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY permission_request_decide ON permission_request FOR UPDATE TO inventory_app
  USING (app_is_platform()) WITH CHECK (app_is_platform());
