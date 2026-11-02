-- An office's files are its own. Files are replaced, never edited, so there's no UPDATE.
GRANT SELECT, INSERT, DELETE ON item_attachment TO inventory_app;
--> statement-breakpoint
ALTER TABLE item_attachment ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE item_attachment FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY item_attachment_read ON item_attachment FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY item_attachment_insert ON item_attachment FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY item_attachment_delete ON item_attachment FOR DELETE TO inventory_app USING (office_id = app_office_id());
