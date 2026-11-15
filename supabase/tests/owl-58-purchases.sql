\set ON_ERROR_STOP on
BEGIN;
-- Existing Auth account without a profile: signing in is not enough to claim.
INSERT INTO group_members(group_id,user_id,role)
VALUES('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000006','member');
CREATE FUNCTION pg_temp.ok(value boolean, message text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.denied(command text, expected text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
  RAISE EXCEPTION 'Expected %: %',expected,command;
END $$;
SET LOCAL ROLE anon;
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'42501');
SELECT pg_temp.ok((SELECT count(*) FROM items)=0,'anonymous reads still denied');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase(NULL,true)$q$,'22023');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',NULL)$q$,'22023');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000999',true)$q$,'42501');
SELECT pg_temp.denied($q$UPDATE items SET purchased=true WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
SELECT pg_temp.denied($q$UPDATE items SET purchased_by=auth.uid() WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
SELECT pg_temp.denied($q$UPDATE items SET purchased_at=now() WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
SELECT pg_temp.denied($q$UPDATE items SET list_id='00000000-0000-0000-0000-000000000102' WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
WITH edited AS(UPDATE items SET title='Forbidden' WHERE id='00000000-0000-0000-0000-000000000201' RETURNING id)
SELECT pg_temp.ok((SELECT count(*) FROM edited)=0,'shopper cannot edit details');
SELECT pg_temp.denied($q$INSERT INTO items(list_id,title) VALUES('00000000-0000-0000-0000-000000000101','Forbidden')$q$,'42501');
SELECT pg_temp.ok((public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)->>'purchased')::boolean,'buyer can claim');
SELECT pg_temp.ok(NOT (public.set_item_purchase('00000000-0000-0000-0000-000000000201',true) ? 'purchased_by'),'RPC response omits buyer identity');
SELECT pg_temp.ok((SELECT purchased_by=auth.uid() AND purchased_at IS NOT NULL FROM items WHERE id='00000000-0000-0000-0000-000000000201'),'server records buyer/time');
DO $$ DECLARE original_time timestamptz; BEGIN
 SELECT purchased_at INTO original_time FROM items WHERE id='00000000-0000-0000-0000-000000000201';
 PERFORM public.set_item_purchase('00000000-0000-0000-0000-000000000201',true);
 IF (SELECT purchased_at FROM items WHERE id='00000000-0000-0000-0000-000000000201') IS DISTINCT FROM original_time
 THEN RAISE EXCEPTION 'Retry changed original timestamp'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true)$q$,'P0001');
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');
SELECT pg_temp.denied($q$UPDATE items SET purchased=false WHERE id='00000000-0000-0000-0000-000000000201'$q$,'42501');
SELECT pg_temp.denied($q$INSERT INTO items(list_id,title,purchased,purchased_by) VALUES('00000000-0000-0000-0000-000000000101','Forged',true,auth.uid())$q$,'42501');
WITH edited AS(UPDATE items SET title='Owner edit',on_sale=true WHERE id='00000000-0000-0000-0000-000000000201' RETURNING id)
SELECT pg_temp.ok((SELECT count(*) FROM edited)=1,'owner manages details');
INSERT INTO items(list_id,title) VALUES('00000000-0000-0000-0000-000000000102','New gift');
SELECT pg_temp.ok((SELECT NOT purchased AND purchased_by IS NULL FROM items WHERE title='New gift'),'new gift starts unclaimed');
SELECT pg_temp.ok((public.set_item_purchase((SELECT id FROM items WHERE title='New gift'),true)->>'purchased')::boolean,'preserve owner self-purchase support');
SELECT pg_temp.ok(NOT (public.set_item_purchase((SELECT id FROM items WHERE title='New gift'),false)->>'purchased')::boolean,'owner can cancel own purchase');
DELETE FROM items WHERE title='New gift';
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.ok(NOT (public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)->>'purchased')::boolean,'buyer can cancel');
SELECT pg_temp.ok((SELECT NOT purchased AND purchased_by IS NULL AND purchased_at IS NULL FROM items WHERE id='00000000-0000-0000-0000-000000000201'),'cancel consistent state');
SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false);
SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DELETE FROM list_shares WHERE list_id='00000000-0000-0000-0000-000000000101';
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.denied($q$SELECT public.set_item_purchase('00000000-0000-0000-0000-000000000201',false)$q$,'42501');
SELECT pg_temp.ok((SELECT count(*) FROM items)=0,'unshare still removes access');
ROLLBACK;
\echo OWL-58 purchase checks passed
