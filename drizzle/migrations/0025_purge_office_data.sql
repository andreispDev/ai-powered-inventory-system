-- Top-level categories without their own columns were already shown as folders. Now that's stored.
UPDATE category SET is_folder = true
  WHERE parent_id IS NULL AND NOT EXISTS (SELECT 1 FROM category_field f WHERE f.category_id = category.id);
--> statement-breakpoint

-- Stock history stays append-only, except while purge_office_data runs. The app role can't delete it either way.
CREATE FUNCTION stock_movement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.purging', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
--> statement-breakpoint
DROP TRIGGER stock_movement_append_only ON stock_movement;
--> statement-breakpoint
CREATE TRIGGER stock_movement_append_only BEFORE UPDATE OR DELETE ON stock_movement
  FOR EACH ROW EXECUTE FUNCTION stock_movement_guard();
--> statement-breakpoint

-- Permanently removes the caller's office's rows, and with p_categories its categories too.
-- The caller logs it. Needs a Developer's one-time approval: the data.purge grant is used up here, so the next purge needs another.
CREATE FUNCTION purge_office_data(p_categories boolean)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller uuid := app_office_id();
  actor uuid := app_user_id();
  items_removed integer;
  categories_removed integer := 0;
BEGIN
  IF caller IS NULL OR actor IS NULL THEN
    RAISE EXCEPTION 'purge_not_allowed';
  END IF;
  DELETE FROM permission_grant
    WHERE subject_type = 'user' AND subject_id = actor AND permission = 'data.purge' AND effect = 'allow'
      AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'purge_not_approved';
  END IF;

  PERFORM set_config('app.purging', 'on', true);
  UPDATE transfer SET status = 'cancelled' WHERE from_office_id = caller AND status = 'pending';
  DELETE FROM forecast WHERE office_id = caller;
  DELETE FROM item_embedding WHERE office_id = caller;
  DELETE FROM item_attachment WHERE office_id = caller;
  DELETE FROM assignment WHERE office_id = caller;
  DELETE FROM stock_movement WHERE office_id = caller;
  DELETE FROM item WHERE office_id = caller;
  GET DIAGNOSTICS items_removed = ROW_COUNT;
  IF p_categories THEN
    DELETE FROM category_field WHERE office_id = caller;
    DELETE FROM category WHERE office_id = caller;
    GET DIAGNOSTICS categories_removed = ROW_COUNT;
  END IF;
  PERFORM set_config('app.purging', '', true);

  RETURN jsonb_build_object('items', items_removed, 'categories', categories_removed);
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION purge_office_data(boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION purge_office_data(boolean) TO inventory_app;
