\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.ok(value boolean, message text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',message; END IF; END $$;
CREATE FUNCTION pg_temp.denied(command text, expected text) RETURNS void LANGUAGE plpgsql AS
$$ BEGIN BEGIN EXECUTE command; EXCEPTION WHEN OTHERS THEN IF SQLSTATE=expected THEN RETURN; END IF; RAISE; END;
RAISE EXCEPTION 'Expected % for %',expected,command; END $$;
SELECT pg_temp.ok(NOT has_column_privilege('anon','public.items','image_url','INSERT'),'anonymous cannot insert thumbnails');
SELECT pg_temp.ok(NOT has_column_privilege('authenticated','public.items','purchased','UPDATE'),'purchase protected');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
UPDATE items SET image_url='https://cdn.example/gift.jpg' WHERE id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.ok((SELECT image_url FROM items WHERE id='00000000-0000-0000-0000-000000000201')='https://cdn.example/gift.jpg','owner saves thumbnail');
INSERT INTO items(list_id,title,image_url) VALUES ('00000000-0000-0000-0000-000000000101','New thumbnail','https://cdn.example/new.jpg');
SELECT pg_temp.denied($q$UPDATE items SET image_url='http://cdn.example/gift.jpg' WHERE id='00000000-0000-0000-0000-000000000201'$q$,'23514');
SELECT pg_temp.denied($q$UPDATE items SET image_url='https://cdn.example/'||repeat('x',2048) WHERE id='00000000-0000-0000-0000-000000000201'$q$,'23514');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.ok((SELECT image_url FROM items WHERE id='00000000-0000-0000-0000-000000000201')='https://cdn.example/gift.jpg','shared member sees image');
UPDATE items SET image_url=NULL WHERE id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.ok((SELECT image_url FROM items WHERE id='00000000-0000-0000-0000-000000000201') IS NOT NULL,'member cannot edit image');
SELECT set_item_purchase('00000000-0000-0000-0000-000000000201',true);
SELECT pg_temp.ok((get_my_purchases()->0->>'image_url')='https://cdn.example/gift.jpg','buyer feed includes thumbnail');
SELECT pg_temp.ok(NOT (get_my_purchases()->0 ? 'buyer_user_id'),'feed does not leak buyer');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
SELECT pg_temp.ok((SELECT count(*) FROM items WHERE id='00000000-0000-0000-0000-000000000201')=0,'unrelated cannot view thumbnail');
SELECT pg_temp.ok(get_my_purchases()='[]'::jsonb,'other user cannot read buyer feed');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
UPDATE items SET image_url=NULL WHERE id='00000000-0000-0000-0000-000000000201';
SELECT pg_temp.ok((SELECT image_url FROM items WHERE id='00000000-0000-0000-0000-000000000201') IS NULL,'owner can remove image');
ROLLBACK;
