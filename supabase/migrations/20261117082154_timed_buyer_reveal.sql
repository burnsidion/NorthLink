-- OWL-80 checkpoint 1: reveal names to the list owner only after the purchase
-- season's Christmas. Do not expose buyer IDs or add them to public gift rows.
BEGIN;

-- A stale lists.year must not reveal a new purchase early. Each purchase uses
-- its own calendar year in Eastern time; January begins the next season.
CREATE FUNCTION northlink_private.buyer_reveal_at(p_purchased_at timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path = ''
AS $$
 SELECT CASE WHEN pg_catalog.isfinite(p_purchased_at) THEN
  pg_catalog.make_timestamptz(
   EXTRACT(YEAR FROM p_purchased_at AT TIME ZONE 'America/New_York')::integer,
   12,26,0,0,0,'America/New_York'
  ) END;
$$;
REVOKE ALL ON FUNCTION northlink_private.buyer_reveal_at(timestamptz) FROM PUBLIC,anon,authenticated;

-- This narrowly scoped definer reads the private buyer mapping only after
-- verifying a real caller owns the requested list. The caller cannot supply
-- an owner, season or clock value. Server time is the sole release authority.
CREATE FUNCTION northlink_private.get_list_buyer_reveal(p_list_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 caller uuid := auth.uid();
 server_now timestamptz := pg_catalog.statement_timestamp();
 result_items jsonb;
BEGIN
 IF caller IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=caller) THEN
  RAISE EXCEPTION 'Sign in to view buyer information.' USING ERRCODE='42501';
 END IF;
 IF p_list_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.lists WHERE id=p_list_id AND owner_user_id=caller
 ) THEN
  RAISE EXCEPTION 'Buyer information is available only to the list owner.' USING ERRCODE='42501';
 END IF;

 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'item_id',gift.id,
  'purchased_at',gift.purchased_at,
  'reveal_at',northlink_private.buyer_reveal_at(gift.purchased_at),
  'revealed',COALESCE(gift.purchased_at<=server_now AND
   northlink_private.buyer_reveal_at(gift.purchased_at)<=server_now,false),
  'buyer_name',CASE WHEN gift.purchased_at<=server_now AND
   northlink_private.buyer_reveal_at(gift.purchased_at)<=server_now
   THEN COALESCE(NULLIF(pg_catalog.btrim(profile.display_name),''),'Buyer unavailable')
   ELSE NULL END
 ) ORDER BY gift.created_at,gift.id),'[]'::jsonb)
 INTO result_items
 FROM public.items gift
 LEFT JOIN northlink_private.item_buyers buyer ON buyer.item_id=gift.id
 LEFT JOIN public.profiles profile ON profile.id=buyer.buyer_user_id
 WHERE gift.list_id=p_list_id AND gift.purchased;

 RETURN pg_catalog.jsonb_build_object(
  'server_time',server_now,'timezone','America/New_York','items',result_items
 );
END;
$$;
REVOKE ALL ON FUNCTION northlink_private.get_list_buyer_reveal(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION northlink_private.get_list_buyer_reveal(uuid) TO authenticated;

CREATE FUNCTION public.get_list_buyer_reveal(p_list_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$ SELECT northlink_private.get_list_buyer_reveal(p_list_id); $$;
REVOKE ALL ON FUNCTION public.get_list_buyer_reveal(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_list_buyer_reveal(uuid) TO authenticated;

COMMIT;
