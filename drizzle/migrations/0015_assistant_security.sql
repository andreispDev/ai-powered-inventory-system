-- Chats belong to the person who had them. Oversight goes through the audit log.
GRANT SELECT, INSERT, UPDATE ON ai_conversation TO inventory_app;
--> statement-breakpoint
ALTER TABLE ai_conversation ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE ai_conversation FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY ai_conversation_own ON ai_conversation FOR ALL TO inventory_app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND office_id IS NOT DISTINCT FROM app_office_id());
--> statement-breakpoint
GRANT SELECT, INSERT ON ai_message TO inventory_app;
--> statement-breakpoint
ALTER TABLE ai_message ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE ai_message FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY ai_message_own ON ai_message FOR ALL TO inventory_app
  USING (user_id = app_user_id())
  WITH CHECK (
    user_id = app_user_id()
    AND office_id IS NOT DISTINCT FROM app_office_id()
    AND EXISTS (SELECT 1 FROM ai_conversation c WHERE c.id = conversation_id AND c.user_id = app_user_id())
  );
