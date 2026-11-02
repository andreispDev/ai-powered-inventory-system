-- Assignments stay inside one office.
GRANT SELECT, INSERT, UPDATE ON assignment TO inventory_app;
--> statement-breakpoint
ALTER TABLE assignment ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE assignment FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY assignment_read ON assignment FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY assignment_insert ON assignment FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY assignment_update ON assignment FOR UPDATE TO inventory_app USING (office_id = app_office_id()) WITH CHECK (office_id = app_office_id());
--> statement-breakpoint

-- A transfer is the one record two offices share. Stock only moves through complete_transfer.
GRANT SELECT, INSERT, UPDATE ON transfer TO inventory_app;
--> statement-breakpoint
ALTER TABLE transfer ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE transfer FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY transfer_read ON transfer FOR SELECT TO inventory_app
  USING (from_office_id = app_office_id() OR to_office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY transfer_insert ON transfer FOR INSERT TO inventory_app WITH CHECK (from_office_id = app_office_id());
--> statement-breakpoint
CREATE POLICY transfer_update ON transfer FOR UPDATE TO inventory_app
  USING (from_office_id = app_office_id() OR to_office_id = app_office_id())
  WITH CHECK (from_office_id = app_office_id() OR to_office_id = app_office_id());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE ON announcement TO inventory_app;
--> statement-breakpoint
ALTER TABLE announcement ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE announcement FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY announcement_read ON announcement FOR SELECT TO inventory_app USING (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY announcement_insert ON announcement FOR INSERT TO inventory_app WITH CHECK (office_id = app_office_id() OR app_is_platform());
--> statement-breakpoint
CREATE POLICY announcement_update ON announcement FOR UPDATE TO inventory_app USING (app_is_platform()) WITH CHECK (app_is_platform());
--> statement-breakpoint

-- People read and mark only their own. Only the worker (platform scope) creates them.
GRANT SELECT, INSERT ON notification TO inventory_app;
--> statement-breakpoint
GRANT UPDATE (read_at, acked_at) ON notification TO inventory_app;
--> statement-breakpoint
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE notification FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY notification_own ON notification FOR SELECT TO inventory_app USING (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY notification_worker_read ON notification FOR SELECT TO inventory_app USING (current_setting('app.worker', true) = 'on');
--> statement-breakpoint
CREATE POLICY notification_insert ON notification FOR INSERT TO inventory_app WITH CHECK (current_setting('app.worker', true) = 'on');
--> statement-breakpoint
CREATE POLICY notification_update ON notification FOR UPDATE TO inventory_app USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());
--> statement-breakpoint

GRANT SELECT, INSERT ON job_run, audit_checkpoint TO inventory_app;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE job_run_id_seq TO inventory_app;
--> statement-breakpoint
ALTER TABLE job_run ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE job_run FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_run_platform ON job_run FOR ALL TO inventory_app USING (app_is_platform()) WITH CHECK (app_is_platform());
--> statement-breakpoint
ALTER TABLE audit_checkpoint ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_checkpoint FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_checkpoint_platform ON audit_checkpoint FOR ALL TO inventory_app USING (app_is_platform()) WITH CHECK (app_is_platform());
--> statement-breakpoint

-- Names only, so an office can choose where to send a transfer without seeing other offices.
CREATE FUNCTION office_directory() RETURNS TABLE (id uuid, name text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT o.id, o.name FROM office o WHERE o.status = 'active' ORDER BY o.name $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION office_directory() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION office_directory() TO inventory_app;
--> statement-breakpoint

-- Read counts for an announcement the caller can see, without exposing who else got what.
CREATE FUNCTION announcement_read_counts(p_id uuid) RETURNS TABLE (total bigint, read bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT count(*), count(n.read_at) FROM notification n
     JOIN announcement a ON a.id = n.announcement_id
     WHERE a.id = p_id
       AND (a.office_id = app_office_id() OR app_is_platform()) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION announcement_read_counts(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION announcement_read_counts(uuid) TO inventory_app;
--> statement-breakpoint

-- The only privileged code touching inventory. Runs as the owner to write to both offices,
-- so it checks the caller itself: only the receiving office can complete a pending transfer.
CREATE FUNCTION complete_transfer(p_transfer uuid, p_category uuid, p_actor uuid, p_actor_name text)
  RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t transfer%ROWTYPE;
  source item%ROWTYPE;
  dest_id uuid;
  dest_quantity integer;
  caller uuid := app_office_id();
BEGIN
  SELECT * INTO t FROM transfer WHERE id = p_transfer FOR UPDATE;
  IF NOT FOUND OR caller IS NULL OR t.to_office_id <> caller THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;
  IF t.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer_not_pending';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM category c WHERE c.id = p_category AND c.office_id = caller AND c.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'transfer_bad_category';
  END IF;

  SELECT * INTO source FROM item WHERE id = t.item_id AND office_id = t.from_office_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR source.quantity < t.quantity THEN
    RAISE EXCEPTION 'transfer_insufficient_stock';
  END IF;

  -- Same SKU adds to the existing item. Otherwise the receiving office gets a new item.
  IF source.sku IS NOT NULL THEN
    SELECT id INTO dest_id FROM item
      WHERE office_id = caller AND sku = source.sku AND deleted_at IS NULL FOR UPDATE;
  END IF;
  IF dest_id IS NULL THEN
    INSERT INTO item (office_id, category_id, name, sku, unit, quantity, condition, serial_number, supplier, unit_cost, purchase_date, warranty_expiry)
      VALUES (caller, p_category, source.name, source.sku, source.unit, 0, source.condition, source.serial_number, source.supplier, source.unit_cost, source.purchase_date, source.warranty_expiry)
      RETURNING id INTO dest_id;
  END IF;

  UPDATE item SET quantity = quantity - t.quantity, version = version + 1, updated_at = now() WHERE id = source.id;
  UPDATE item SET quantity = quantity + t.quantity, version = version + 1, updated_at = now() WHERE id = dest_id
    RETURNING quantity INTO dest_quantity;

  INSERT INTO stock_movement (office_id, item_id, type, delta, balance_after, reason, actor_id) VALUES
    (t.from_office_id, source.id, 'transfer_out', -t.quantity, source.quantity - t.quantity, 'Transferred to ' || t.to_office_name, p_actor),
    (caller, dest_id, 'transfer_in', t.quantity, dest_quantity, 'Transferred from ' || t.from_office_name, p_actor);

  UPDATE transfer SET status = 'accepted', responded_by_name = p_actor_name, responded_at = now() WHERE id = p_transfer;

  INSERT INTO audit_log (office_id, actor_id, action, entity_type, entity_id, after) VALUES
    (t.from_office_id, p_actor, 'transfer.completed', 'transfer', p_transfer::text, jsonb_build_object('quantity', t.quantity, 'to', t.to_office_name)),
    (caller, p_actor, 'transfer.completed', 'transfer', p_transfer::text, jsonb_build_object('quantity', t.quantity, 'from', t.from_office_name));

  RETURN dest_id;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION complete_transfer(uuid, uuid, uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION complete_transfer(uuid, uuid, uuid, text) TO inventory_app;
