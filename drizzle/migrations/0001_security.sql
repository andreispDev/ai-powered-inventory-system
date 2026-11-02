-- Roles, office separation and append-only rules. See Architectural.md section 5.
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inventory_app') THEN CREATE ROLE inventory_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'inventory_auth') THEN CREATE ROLE inventory_auth NOLOGIN; END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO inventory_app, inventory_auth;
--> statement-breakpoint
CREATE FUNCTION app_office_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.office_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_is_platform() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(current_setting('app.scope', true), '') = 'platform' $$;
--> statement-breakpoint
CREATE FUNCTION reject_change() RETURNS trigger LANGUAGE plpgsql AS
  $$ BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
--> statement-breakpoint

-- office
ALTER TABLE office ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE office FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON office TO inventory_app;
--> statement-breakpoint
CREATE POLICY office_read ON office FOR SELECT TO inventory_app USING (id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY office_insert ON office FOR INSERT TO inventory_app WITH CHECK (app_is_platform());
--> statement-breakpoint
CREATE POLICY office_update ON office FOR UPDATE TO inventory_app USING (app_is_platform()) WITH CHECK (app_is_platform());
--> statement-breakpoint
GRANT SELECT ON office TO inventory_auth;
--> statement-breakpoint
CREATE POLICY office_auth ON office FOR SELECT TO inventory_auth USING (true);
--> statement-breakpoint

-- app_user
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON app_user TO inventory_app;
--> statement-breakpoint
CREATE POLICY app_user_read ON app_user FOR SELECT TO inventory_app
  USING (office_id = app_office_id() OR id = app_user_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY app_user_insert ON app_user FOR INSERT TO inventory_app
  WITH CHECK (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY app_user_update ON app_user FOR UPDATE TO inventory_app
  USING (office_id = app_office_id() OR app_is_platform())
  WITH CHECK (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
GRANT SELECT, UPDATE ON app_user TO inventory_auth;
--> statement-breakpoint
CREATE POLICY app_user_auth_read ON app_user FOR SELECT TO inventory_auth USING (true);
--> statement-breakpoint
CREATE POLICY app_user_auth_update ON app_user FOR UPDATE TO inventory_auth USING (true) WITH CHECK (true);
--> statement-breakpoint

-- Sign-in tables are for the auth role only.
GRANT SELECT, INSERT, UPDATE, DELETE ON session, account, verification TO inventory_auth;
--> statement-breakpoint

-- permission_grant
ALTER TABLE permission_grant ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE permission_grant FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON permission_grant TO inventory_app;
--> statement-breakpoint
CREATE POLICY permission_grant_read ON permission_grant FOR SELECT TO inventory_app
  USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY permission_grant_write ON permission_grant FOR ALL TO inventory_app
  USING (app_is_platform()) WITH CHECK (app_is_platform());
--> statement-breakpoint
GRANT SELECT ON permission_grant TO inventory_auth;
--> statement-breakpoint
CREATE POLICY permission_grant_auth ON permission_grant FOR SELECT TO inventory_auth USING (true);
--> statement-breakpoint

-- audit_log: add and read only, for every role including the table owner.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO inventory_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE audit_log_id_seq TO inventory_app, inventory_auth;
--> statement-breakpoint
CREATE POLICY audit_log_read ON audit_log FOR SELECT TO inventory_app
  USING (office_id = app_office_id() OR actor_id = app_user_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY audit_log_insert ON audit_log FOR INSERT TO inventory_app
  WITH CHECK (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
GRANT INSERT ON audit_log TO inventory_auth;
--> statement-breakpoint
CREATE POLICY audit_log_auth_insert ON audit_log FOR INSERT TO inventory_auth WITH CHECK (true);
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_change();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change();
--> statement-breakpoint

-- outbox
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE outbox FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON outbox TO inventory_app;
--> statement-breakpoint
CREATE POLICY outbox_insert ON outbox FOR INSERT TO inventory_app
  WITH CHECK (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY outbox_platform ON outbox FOR ALL TO inventory_app
  USING (app_is_platform()) WITH CHECK (app_is_platform());
