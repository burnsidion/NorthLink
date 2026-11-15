\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.ok(value boolean, message text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.denied(command text, expected text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN BEGIN EXECUTE command;
EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
RAISE EXCEPTION 'Expected % for %',expected,command; END $$;

-- All 79 mappings and all non-buyer gift data survive the cutover exactly.
SELECT pg_temp.ok((SELECT count(*) FROM northlink_private.item_buyers)=79,'preserved all buyers');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT item_id,buyer_user_id FROM northlink_private.item_buyers
 EXCEPT SELECT id,purchased_by FROM purchase_privacy_expected WHERE purchased_by IS NOT NULL
),'no changed or invented buyers');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT id,purchased_by FROM purchase_privacy_expected WHERE purchased_by IS NOT NULL
 EXCEPT SELECT item_id,buyer_user_id FROM northlink_private.item_buyers
),'no missing buyers');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT id,safe_record FROM purchase_privacy_expected
 EXCEPT SELECT id,to_jsonb(i) FROM public.items i
),'all public gift data and timestamps preserved');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT 1 FROM pg_attribute WHERE attrelid='public.items'::regclass
 AND attname='purchased_by' AND NOT attisdropped
),'buyer column absent');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT 1 FROM pg_publication_tables WHERE schemaname='northlink_private'
),'private buyer table not published');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT 1 FROM pg_publication_tables WHERE tablename='items' AND 'purchased_by'=ANY(attnames)
),'public realtime publication has no buyer field');

SET LOCAL ROLE anon;
SELECT pg_temp.denied($q$SELECT public.get_my_purchases()$q$,'42501');
SELECT pg_temp.denied($q$SELECT * FROM northlink_private.item_buyers$q$,'42501');
SELECT pg_temp.ok((SELECT count(*) FROM items)=0,'anon sees no gifts');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.denied($q$SELECT public.get_my_purchases()$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
SELECT pg_temp.denied($q$SELECT public.get_my_purchases()$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.denied($q$SELECT * FROM northlink_private.item_buyers$q$,'42501');
SELECT pg_temp.denied($q$SELECT purchased_by FROM public.items$q$,'42703');
SELECT pg_temp.denied($q$SELECT id FROM public.items WHERE purchased_by='00000000-0000-0000-0000-000000000002'$q$,'42703');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT 1 FROM items i WHERE to_jsonb(i) ? 'purchased_by' OR to_jsonb(i) ? 'buyer_user_id'
),'select-star/row JSON does not expose identity');
SELECT pg_temp.ok((SELECT purchased AND purchased_at IS NOT NULL FROM items WHERE id='00000000-0000-0000-0000-000000000201'),'owner keeps purchase visibility');
SELECT pg_temp.ok(NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(public.get_my_purchases()) p WHERE p->>'id'='00000000-0000-0000-0000-000000000201'
),'owner cannot retrieve shoppers purchases');
SELECT pg_temp.ok(EXISTS(
 SELECT 1 FROM jsonb_array_elements(public.get_my_purchases()) p WHERE p->>'id'='00000000-0000-0000-0000-000000000202'
),'existing owner self-purchases remain available');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');
WITH edited AS(UPDATE items SET title='Owner edit' WHERE id='00000000-0000-0000-0000-000000000201' RETURNING id)
SELECT pg_temp.ok((SELECT count(*) FROM edited)=1,'owner edit remains available');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.ok(jsonb_array_length(public.get_my_purchases())=1,'shopper sees only own accessible purchase');
SELECT pg_temp.ok((public.get_my_purchases()->0->>'list_owner_name')='Test 1','owner name still displays');
SELECT pg_temp.ok(NOT ((public.get_my_purchases()->0) ? 'buyer_user_id'),'my purchases has no buyer field');
SELECT pg_temp.ok(NOT (public.set_item_purchase('00000000-0000-0000-0000-000000000201',true) ? 'purchased_by'),'purchase response still safe');
SELECT pg_temp.denied($q$SELECT * FROM northlink_private.item_buyers$q$,'42501');
SELECT pg_temp.denied($q$INSERT INTO northlink_private.item_buyers VALUES('00000000-0000-0000-0000-000000000203',auth.uid())$q$,'42501');
SELECT pg_temp.denied($q$UPDATE northlink_private.item_buyers SET buyer_user_id=auth.uid()$q$,'42501');
SELECT pg_temp.denied($q$DELETE FROM northlink_private.item_buyers$q$,'42501');
SELECT pg_temp.denied($q$UPDATE items SET purchased=false WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
WITH edited AS(UPDATE items SET title='Forbidden' WHERE id='00000000-0000-0000-0000-000000000201' RETURNING id)
SELECT pg_temp.ok((SELECT count(*) FROM edited)=0,'shopper cannot edit details');
DO $$ DECLARE original_time timestamptz; BEGIN
 SELECT purchased_at INTO original_time FROM items WHERE id='00000000-0000-0000-0000-000000000201';
 PERFORM public.set_item_purchase('00000000-0000-0000-0000-000000000201',true);
 IF (SELECT purchased_at FROM items WHERE id='00000000-0000-0000-0000-000000000201') IS DISTINCT FROM original_time
 THEN RAISE EXCEPTION 'Retry changed timestamp'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.ok(jsonb_array_length(public.get_my_purchases())=0,'another shopper cannot list purchases');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'P0001');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.ok(jsonb_array_length(public.get_my_purchases())=0,'unshared purchase does not grant list access');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false);
SELECT pg_temp.ok(jsonb_array_length(public.get_my_purchases())=0,'cancel removes from my purchases');
SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false);
SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true);
RESET ROLE;
SELECT pg_temp.ok((SELECT buyer_user_id='00000000-0000-0000-0000-000000000002' FROM northlink_private.item_buyers WHERE item_id='00000000-0000-0000-0000-000000000201'),'new claims use private mapping');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DELETE FROM list_shares WHERE list_id='00000000-0000-0000-0000-000000000101';
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.ok(jsonb_array_length(public.get_my_purchases())=0,'unshare removes purchase details');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');
RESET ROLE;
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM northlink_private.item_buyers WHERE item_id='00000000-0000-0000-0000-000000000201'),'unsharing preserves buyer record');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DELETE FROM items WHERE id='00000000-0000-0000-0000-000000000202';
RESET ROLE;
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM northlink_private.item_buyers WHERE item_id='00000000-0000-0000-0000-000000000202'),'existing deletion behavior cascades');
ROLLBACK;
\echo OWL-58 buyer privacy checks passed
