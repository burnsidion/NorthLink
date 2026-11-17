\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.ok(value boolean, message text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.denied(command text, expected text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
RAISE EXCEPTION 'Expected % for %',expected,command; END $$;

-- The migration adds only functions; existing gifts, timestamps and buyer mappings survive.
SELECT pg_temp.ok(NOT EXISTS(SELECT * FROM owl80_items_before EXCEPT SELECT to_jsonb(i) FROM items i),'gift data preserved');
SELECT pg_temp.ok(NOT EXISTS(SELECT * FROM owl80_buyers_before EXCEPT SELECT to_jsonb(b) FROM northlink_private.item_buyers b),'buyer records preserved');
SELECT pg_temp.ok((SELECT count(*) FROM items)=(SELECT count(*) FROM owl80_items_before),'no new gifts');
SELECT pg_temp.ok((SELECT count(*) FROM northlink_private.item_buyers)=(SELECT count(*) FROM owl80_buyers_before),'no new buyers');
SELECT pg_temp.ok((SELECT definition FROM owl80_purchase_function_before)=pg_get_functiondef('northlink_private.set_item_purchase(uuid,boolean)'::regprocedure),'purchase writes unchanged');
SELECT pg_temp.ok((SELECT definition FROM owl80_feed_before)=pg_get_functiondef('northlink_private.get_my_purchases()'::regprocedure),'buyer feed unchanged');

-- Catalog checks cover the local equivalent of the function advisor rules.
SELECT pg_temp.ok((SELECT NOT prosecdef FROM pg_proc WHERE oid='public.get_list_buyer_reveal(uuid)'::regprocedure),'public wrapper is invoker');
SELECT pg_temp.ok((SELECT prosecdef FROM pg_proc WHERE oid='northlink_private.get_list_buyer_reveal(uuid)'::regprocedure),'privileged lookup lives in private schema');
SELECT pg_temp.ok((SELECT 'search_path=""'=ANY(proconfig) FROM pg_proc WHERE oid='northlink_private.get_list_buyer_reveal(uuid)'::regprocedure),'definer pins empty search path');
SELECT pg_temp.ok(NOT has_function_privilege('anon','public.get_list_buyer_reveal(uuid)','EXECUTE'),'anonymous wrapper execution revoked');
SELECT pg_temp.ok(NOT has_function_privilege('anon','northlink_private.get_list_buyer_reveal(uuid)','EXECUTE'),'anonymous private execution revoked');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated','northlink_private.buyer_reveal_at(timestamptz)','EXECUTE'),'pure helper not granted to clients');

-- Eastern season calculation must be independent of the connection timezone.
SET LOCAL TIME ZONE 'Pacific/Kiritimati';
SELECT pg_temp.ok(northlink_private.buyer_reveal_at('2026-07-01T12:00:00Z')='2026-12-26T05:00:00Z','summer purchase uses EST December cutoff');
SELECT pg_temp.ok(northlink_private.buyer_reveal_at('2026-12-26T04:59:59.999999Z')='2026-12-26T05:00:00Z','last microsecond of Christmas stays same season');
SELECT pg_temp.ok(northlink_private.buyer_reveal_at('2027-01-01T04:59:59Z')='2026-12-26T05:00:00Z','UTC new year is still December in Eastern time');
SELECT pg_temp.ok(northlink_private.buyer_reveal_at('2027-01-01T05:00:00Z')='2027-12-26T05:00:00Z','Eastern January starts new season');
SELECT pg_temp.ok(northlink_private.buyer_reveal_at(NULL) IS NULL,'missing date fails closed');
SELECT pg_temp.ok(northlink_private.buyer_reveal_at('infinity') IS NULL,'invalid infinite date fails closed');
SET LOCAL TIME ZONE 'UTC';

UPDATE lists SET year=2025 WHERE id='00000000-0000-0000-0000-000000000101';
UPDATE items SET purchased=true,purchased_at='2026-11-17T12:00:00Z' WHERE id='00000000-0000-0000-0000-000000000201';
UPDATE items SET purchased=true,purchased_at='2025-12-24T12:00:00Z' WHERE id='00000000-0000-0000-0000-000000000202';
UPDATE items SET purchased=true,purchased_at='2026-11-18T12:00:00Z' WHERE id='00000000-0000-0000-0000-000000000203';
INSERT INTO items(id,list_id,title,purchased,purchased_at) VALUES
 ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000101','Late purchase',true,'2026-12-26T05:30:00Z'),
 ('00000000-0000-0000-0000-000000000206','00000000-0000-0000-0000-000000000101','Next season',true,'2027-01-01T05:00:00Z'),
 ('00000000-0000-0000-0000-000000000207','00000000-0000-0000-0000-000000000101','December 31 purchase',true,'2027-01-01T04:59:59Z');
INSERT INTO northlink_private.item_buyers(item_id,buyer_user_id) VALUES
 ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000005'),
 ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000206','00000000-0000-0000-0000-000000000005'),
 ('00000000-0000-0000-0000-000000000207','00000000-0000-0000-0000-000000000005')
ON CONFLICT(item_id) DO UPDATE SET buyer_user_id=excluded.buyer_user_id;

-- Test the exact RPC at controlled times by substituting only its server clock
-- in this rollback-only disposable fixture. Production has no clock parameter,
-- clock setter, test role or time override.
CREATE TEMP TABLE owl80_original_reveal AS SELECT pg_get_functiondef('northlink_private.get_list_buyer_reveal(uuid)'::regprocedure) AS definition;
CREATE FUNCTION pg_temp.at_time(value timestamptz) RETURNS void LANGUAGE plpgsql AS $$
DECLARE original text; BEGIN
 SELECT definition INTO original FROM owl80_original_reveal;
 IF position('pg_catalog.statement_timestamp()' in original)=0 THEN RAISE EXCEPTION 'Server clock substitution missing'; END IF;
 EXECUTE replace(original,'pg_catalog.statement_timestamp()',format('%L::timestamptz',value));
END $$;
CREATE FUNCTION pg_temp.gift(list_id uuid,item_id uuid) RETURNS jsonb LANGUAGE sql AS $$
 SELECT entry FROM jsonb_array_elements(public.get_list_buyer_reveal(list_id)->'items') AS entry WHERE entry->>'item_id'=item_id::text;
$$;

SELECT pg_temp.at_time('2026-12-26T04:59:59.999999Z');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->'revealed'='false','hidden immediately before Eastern midnight on stale 2025 list');
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->'buyer_name'='null','no buyer name sent before cutoff');
SELECT pg_temp.ok((public.get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')::text NOT LIKE '%Test 2%'),'no hidden name elsewhere in payload');
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000202')->>'buyer_name'='Test 5','historical prior-season reveal remains available');
SELECT pg_temp.ok(public.get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')->>'timezone'='America/New_York','explicit timezone supplied');
SELECT pg_temp.ok((public.get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')->>'server_time')::timestamptz='2026-12-26T04:59:59.999999Z','server timestamp supplied');

RESET ROLE;
SELECT pg_temp.at_time('2026-12-26T05:00:00Z');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->'revealed'='true','revealed exactly at Eastern midnight');
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->>'buyer_name'='Test 2','owner receives buyer name after cutoff');
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000205')->'revealed'='false','future-dated purchases do not reveal before purchase time');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')->'items') entry WHERE entry ?| ARRAY['buyer_user_id','purchased_by','buyer_id','avatar_url']),'only intended display fields, no raw buyer IDs');
SELECT pg_temp.ok(NOT has_table_privilege('authenticated','northlink_private.item_buyers','SELECT'),'private table stays inaccessible');
SELECT pg_temp.denied($q$SELECT * FROM northlink_private.item_buyers$q$,'42501');
SELECT pg_temp.denied($q$SELECT northlink_private.buyer_reveal_at(now())$q$,'42501');
SELECT pg_temp.ok(NOT has_column_privilege('authenticated','public.items','purchased_at','UPDATE'),'clients cannot move purchase time');
SELECT pg_temp.denied($q$UPDATE items SET purchased_at='2025-01-01' WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
SELECT pg_temp.denied($q$SELECT set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');

-- Shared members, the buyer, unrelated accounts, signed-out and forged callers
-- cannot use an owned-list parameter or an alternate wrapper to bypass checks.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SELECT pg_temp.denied($q$SELECT northlink_private.get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000999',true);
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SET LOCAL ROLE anon;
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');
SELECT pg_temp.denied($q$SELECT northlink_private.get_list_buyer_reveal('00000000-0000-0000-0000-000000000101')$q$,'42501');

RESET ROLE;
SELECT pg_temp.at_time('2026-12-26T05:30:00Z');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000205')->>'buyer_name'='Test 2','late purchase immediately reveals without job or rewrite');
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal(NULL)$q$,'42501');
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000999')$q$,'42501');
SELECT pg_temp.ok(get_list_buyer_reveal('00000000-0000-0000-0000-000000000104')->'items'='[]','empty/unpurchased list has no buyer records');
SELECT pg_temp.denied($q$SELECT get_list_buyer_reveal('00000000-0000-0000-0000-000000000101','2030-12-26'::timestamptz)$q$,'42883');

RESET ROLE;
SELECT pg_temp.at_time('2027-01-01T05:00:00Z');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->>'buyer_name'='Test 2','revealed gifts do not rehide at new year');
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000207')->>'buyer_name'='Test 5','late December purchase is revealed across UTC year boundary');
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000206')->'buyer_name'='null','new January purchase stays private for its season');

-- The buyer can still cancel; reveal disappears and a later claim uses its new time.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT set_item_purchase('00000000-0000-0000-0000-000000000201',false);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201') IS NULL,'canceled purchase has no reveal');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
SELECT set_item_purchase('00000000-0000-0000-0000-000000000201',true);
RESET ROLE;
UPDATE items SET purchased_at='2027-01-01T05:00:00Z' WHERE id='00000000-0000-0000-0000-000000000201';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->'buyer_name'='null','new claim does not inherit old reveal');
RESET ROLE;
SELECT pg_temp.at_time('2027-12-26T05:00:00Z');
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000201')->>'buyer_name'='Test 5','new buyer revealed at next season cutoff');

-- Blank profile names are handled without leaking email or raw identifiers.
RESET ROLE;
UPDATE profiles SET display_name=' ' WHERE id='00000000-0000-0000-0000-000000000005';
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(pg_temp.gift('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000206')->>'buyer_name'='Buyer unavailable','missing display name has safe fallback');
ROLLBACK;
