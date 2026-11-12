\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.assert_true(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
SET LOCAL ROLE anon;
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=0,'anon items');
SELECT pg_temp.assert_true((SELECT count(*) FROM lists)=0,'anon lists');
DO $$ BEGIN
  BEGIN PERFORM * FROM v_user_accessible_lists; RAISE EXCEPTION 'anon metadata allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM * FROM list_progress; RAISE EXCEPTION 'anon progress allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
WITH changed AS (UPDATE items SET title='forbidden' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=0,'anon update');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=1,'shopper sees only explicit share');
SELECT pg_temp.assert_true((SELECT count(*) FROM lists)=1,'shopper list visibility');
SELECT pg_temp.assert_true((SELECT count(*) FROM v_user_accessible_lists)=1,'shopper metadata');
SELECT pg_temp.assert_true((SELECT owner_display_name FROM v_user_accessible_lists LIMIT 1)='Test 1','owner name preserved');
SELECT pg_temp.assert_true((SELECT count(*) FROM list_progress)=1,'shopper progress');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM v_user_accessible_lists WHERE shared_user_id IS DISTINCT FROM auth.uid()),'no other member identities');
WITH changed AS (UPDATE items SET purchased=true,purchased_by='00000000-0000-0000-0000-000000000002' WHERE id='00000000-0000-0000-0000-000000000201' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=1,'shopper purchase');
WITH changed AS (UPDATE items SET purchased=true WHERE id='00000000-0000-0000-0000-000000000202' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=0,'shopper private update denied');
DO $$ BEGIN
  BEGIN UPDATE items SET list_id='00000000-0000-0000-0000-000000000102' WHERE id='00000000-0000-0000-0000-000000000201';
  RAISE EXCEPTION 'move into hidden list allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=1 AND (SELECT list_id FROM items LIMIT 1)='00000000-0000-0000-0000-000000000104','other group isolated');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM lists)=2,'multiple groups work');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=1,'outsider only owns own item');
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM v_user_accessible_lists WHERE owner_user_id='00000000-0000-0000-0000-000000000001'),'outsider metadata denied');
WITH changed AS (UPDATE items SET title='forbidden' WHERE id='00000000-0000-0000-0000-000000000201' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=0,'outsider update');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=0,'authenticated role without identity');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM lists)=3,'owner sees own private and shared lists');
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=3,'owner sees own items');
SELECT pg_temp.assert_true((SELECT count(DISTINCT id) FROM v_user_accessible_lists)=3,'owner metadata includes shares to other groups');
WITH changed AS (UPDATE items SET title='Edited' WHERE id='00000000-0000-0000-0000-000000000202' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=1,'owner edit');
INSERT INTO items(id,list_id,title) VALUES ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000102','Added');
WITH changed AS (DELETE FROM items WHERE id='00000000-0000-0000-0000-000000000205' RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=1,'owner add/delete');
DELETE FROM list_shares WHERE list_id='00000000-0000-0000-0000-000000000101';
SELECT pg_temp.assert_true(NOT EXISTS(SELECT 1 FROM list_shares WHERE list_id='00000000-0000-0000-0000-000000000101'),'owner unshare');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.assert_true((SELECT count(*) FROM items)=0,'unshare revokes items');
SELECT pg_temp.assert_true((SELECT count(*) FROM lists)=0,'unshare revokes lists');
SELECT pg_temp.assert_true((SELECT count(*) FROM v_user_accessible_lists)=0,'unshare revokes metadata');
SELECT pg_temp.assert_true((SELECT count(*) FROM list_progress)=0,'unshare revokes progress');
WITH changed AS (UPDATE items SET purchased=false RETURNING id)
SELECT pg_temp.assert_true((SELECT count(*) FROM changed)=0,'unshare revokes writes');
ROLLBACK;
\echo OWL-55 permission checks passed
