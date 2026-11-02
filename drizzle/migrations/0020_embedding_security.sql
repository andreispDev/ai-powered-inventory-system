-- People search their own office's vectors. Only the worker writes them.
GRANT SELECT, INSERT, UPDATE ON item_embedding TO inventory_app;
--> statement-breakpoint
ALTER TABLE item_embedding ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE item_embedding FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY item_embedding_read ON item_embedding FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY item_embedding_insert ON item_embedding FOR INSERT TO inventory_app WITH CHECK (current_setting('app.worker', true) = 'on');
--> statement-breakpoint
CREATE POLICY item_embedding_update ON item_embedding FOR UPDATE TO inventory_app
  USING (current_setting('app.worker', true) = 'on') WITH CHECK (current_setting('app.worker', true) = 'on');
