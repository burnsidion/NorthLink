-- OWL-58 checkpoint 1. Buyer identity remains readable until checkpoint 2.
BEGIN;

CREATE OR REPLACE FUNCTION northlink_private.set_item_purchase(p_item_id uuid, p_purchased boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  gift public.items;
BEGIN
  IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=caller) THEN
    RAISE EXCEPTION 'Sign in before changing a purchase.' USING ERRCODE='42501';
  END IF;
  IF p_item_id IS NULL OR p_purchased IS NULL THEN
    RAISE EXCEPTION 'A gift and purchase status are required.' USING ERRCODE='22023';
  END IF;

  -- Serialize competing claims/cancellations. Check authorization again after
  -- acquiring the lock; a retry must not trust stale screen state.
  SELECT * INTO gift FROM public.items WHERE id=p_item_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(
    SELECT 1 FROM public.lists l WHERE l.id=gift.list_id AND
    (l.owner_user_id=caller OR EXISTS(
      SELECT 1 FROM public.list_shares ls
      JOIN public.group_members gm ON gm.group_id=ls.group_id
      WHERE ls.list_id=l.id AND gm.user_id=caller
    ))
  ) THEN
    RAISE EXCEPTION 'This gift is unavailable or no longer shared with you.' USING ERRCODE='42501';
  END IF;

  IF p_purchased THEN
    IF gift.purchased AND gift.purchased_by IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Someone else already purchased this gift. Refresh to see its current status.' USING ERRCODE='P0001';
    END IF;
    IF NOT gift.purchased THEN
      IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=caller) THEN
        RAISE EXCEPTION 'Complete your profile before purchasing a gift.' USING ERRCODE='42501';
      END IF;
      UPDATE public.items SET purchased=true, purchased_by=caller,
        purchased_at=pg_catalog.statement_timestamp() WHERE id=p_item_id
        RETURNING * INTO gift;
    END IF;
  ELSE
    IF gift.purchased AND gift.purchased_by IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Only the person who purchased this gift can undo it.' USING ERRCODE='42501';
    END IF;
    IF gift.purchased THEN
      UPDATE public.items SET purchased=false, purchased_by=NULL, purchased_at=NULL
        WHERE id=p_item_id RETURNING * INTO gift;
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('purchased',gift.purchased,'purchased_at',gift.purchased_at);
END;
$$;
REVOKE ALL ON FUNCTION northlink_private.set_item_purchase(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION northlink_private.set_item_purchase(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_item_purchase(p_item_id uuid, p_purchased boolean)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = ''
AS $$ SELECT northlink_private.set_item_purchase(p_item_id,p_purchased); $$;
REVOKE ALL ON FUNCTION public.set_item_purchase(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_item_purchase(uuid,boolean) TO authenticated;

DROP POLICY IF EXISTS "Users can update items from accessible lists" ON public.items;
-- The existing owner-only policy continues to govern ordinary item edits.
-- Revoke table AND column grants so custom requests cannot set purchase fields,
-- choose their buyer/time, or move a gift by rewriting list_id.
REVOKE INSERT, UPDATE, TRUNCATE ON public.items FROM PUBLIC,anon,authenticated;
DO $$ DECLARE col record; BEGIN
  FOR col IN SELECT attname FROM pg_attribute
    WHERE attrelid='public.items'::regclass AND attnum>0 AND NOT attisdropped
  LOOP
    EXECUTE pg_catalog.format('REVOKE INSERT (%I), UPDATE (%I) ON public.items FROM PUBLIC, anon, authenticated',col.attname,col.attname);
  END LOOP;
END $$;
GRANT INSERT(list_id,title,price_cents,link,notes,most_wanted,on_sale)
  ON public.items TO authenticated;
GRANT UPDATE(title,price_cents,link,notes,most_wanted,on_sale)
  ON public.items TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
