-- OWL-58 checkpoint 2: public gift rows must never contain buyer identity.
BEGIN;
-- Prevent claims/cancellations changing the source while identities are copied.
LOCK TABLE public.items IN ACCESS EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.items
    WHERE (purchased AND (purchased_by IS NULL OR purchased_at IS NULL))
       OR (NOT purchased AND purchased_by IS NOT NULL)) THEN
    RAISE EXCEPTION 'Inconsistent purchase records: stop and review before moving buyers.';
  END IF;
END $$;

CREATE TABLE northlink_private.item_buyers (
  item_id uuid PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES public.profiles(id)
);
ALTER TABLE northlink_private.item_buyers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON northlink_private.item_buyers FROM PUBLIC, anon, authenticated;
CREATE INDEX item_buyers_by_buyer ON northlink_private.item_buyers(buyer_user_id);

INSERT INTO northlink_private.item_buyers(item_id,buyer_user_id)
SELECT id,purchased_by FROM public.items WHERE purchased;
-- Verify exact mappings before removing the original column. No CASCADE:
-- unexpected dependent views must stop the transaction rather than be dropped.
DO $$ BEGIN
  IF EXISTS(
    SELECT id,purchased_by FROM public.items WHERE purchased
    EXCEPT SELECT item_id,buyer_user_id FROM northlink_private.item_buyers
  ) OR EXISTS(
    SELECT item_id,buyer_user_id FROM northlink_private.item_buyers
    EXCEPT SELECT id,purchased_by FROM public.items WHERE purchased
  ) THEN RAISE EXCEPTION 'Buyer preservation check failed'; END IF;
END $$;

CREATE OR REPLACE FUNCTION northlink_private.set_item_purchase(p_item_id uuid, p_purchased boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  gift public.items;
  buyer uuid;
BEGIN
  IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=caller) THEN
    RAISE EXCEPTION 'Sign in before changing a purchase.' USING ERRCODE='42501';
  END IF;
  IF p_item_id IS NULL OR p_purchased IS NULL THEN
    RAISE EXCEPTION 'A gift and purchase status are required.' USING ERRCODE='22023';
  END IF;
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
  SELECT buyer_user_id INTO buyer FROM northlink_private.item_buyers WHERE item_id=p_item_id;
  IF gift.purchased IS DISTINCT FROM (buyer IS NOT NULL) THEN
    RAISE EXCEPTION 'Purchase state needs repair. Please contact the app owner.' USING ERRCODE='23514';
  END IF;
  IF p_purchased THEN
    IF gift.purchased AND buyer IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Someone else already purchased this gift. Refresh to see its current status.' USING ERRCODE='P0001';
    END IF;
    IF NOT gift.purchased THEN
      IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=caller) THEN
        RAISE EXCEPTION 'Complete your profile before purchasing a gift.' USING ERRCODE='42501';
      END IF;
      INSERT INTO northlink_private.item_buyers(item_id,buyer_user_id) VALUES(p_item_id,caller);
      UPDATE public.items SET purchased=true,purchased_at=pg_catalog.statement_timestamp()
        WHERE id=p_item_id RETURNING * INTO gift;
    END IF;
  ELSE
    IF gift.purchased AND buyer IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Only the person who purchased this gift can undo it.' USING ERRCODE='42501';
    END IF;
    IF gift.purchased THEN
      DELETE FROM northlink_private.item_buyers WHERE item_id=p_item_id;
      UPDATE public.items SET purchased=false,purchased_at=NULL
        WHERE id=p_item_id RETURNING * INTO gift;
    END IF;
  END IF;
  RETURN pg_catalog.jsonb_build_object('purchased',gift.purchased,'purchased_at',gift.purchased_at);
END;
$$;
REVOKE ALL ON FUNCTION northlink_private.set_item_purchase(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION northlink_private.set_item_purchase(uuid,boolean) TO authenticated;

CREATE FUNCTION northlink_private.get_my_purchases()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=caller) THEN
    RAISE EXCEPTION 'Sign in to view your purchases.' USING ERRCODE='42501';
  END IF;
  RETURN (
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',i.id,'title',i.title,'price_cents',i.price_cents,
      'link',i.link,'notes',i.notes,'most_wanted',i.most_wanted,
      'list_title',l.title,'list_owner_name',COALESCE(p.display_name,'List owner')
    ) ORDER BY i.purchased_at DESC,i.id),'[]'::jsonb)
    FROM northlink_private.item_buyers b
    JOIN public.items i ON i.id=b.item_id
    JOIN public.lists l ON l.id=i.list_id
    LEFT JOIN public.profiles p ON p.id=l.owner_user_id
    WHERE b.buyer_user_id=caller AND i.purchased
    AND (l.owner_user_id=caller OR EXISTS(
      SELECT 1 FROM public.list_shares ls
      JOIN public.group_members gm ON gm.group_id=ls.group_id
      WHERE ls.list_id=l.id AND gm.user_id=caller
    ))
  );
END;
$$;
REVOKE ALL ON FUNCTION northlink_private.get_my_purchases() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION northlink_private.get_my_purchases() TO authenticated;
CREATE FUNCTION public.get_my_purchases()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT northlink_private.get_my_purchases(); $$;
REVOKE ALL ON FUNCTION public.get_my_purchases() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_purchases() TO authenticated;

ALTER TABLE public.items DROP COLUMN purchased_by;
NOTIFY pgrst, 'reload schema';
COMMIT;
