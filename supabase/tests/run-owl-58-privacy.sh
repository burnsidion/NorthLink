#!/usr/bin/env bash
# Only a disposable local database; never uses .env or hosted URLs.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="northlink-owl58-privacy-$$"
cleanup() { docker rm -f "${container}-rest" "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" --network none \
  --user postgres --entrypoint sh public.ecr.aws/supabase/postgres:17.6.1.147 \
  -c "initdb -D /tmp/northlink-pg --auth=trust >/dev/null && exec postgres -D /tmp/northlink-pg -k /tmp -c listen_addresses='127.0.0.1'" >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h /tmp -U postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo "Test database did not become ready" >&2; exit 1; fi
sql() { docker exec -i "$container" psql -h /tmp -X -q -U postgres -v ON_ERROR_STOP=1; }
sql < supabase/tests/owl-55-fixture.sql
sql < supabase/tests/owl-55-seed.sql
sql < supabase/migrations/20261112042611_restrict_gift_access.sql
sql <<'SQL'
UPDATE public.groups SET invite_code='ABCDEFGH' WHERE id='00000000-0000-0000-0000-000000000011';
UPDATE public.groups SET invite_code='JKLMNPQR' WHERE id='00000000-0000-0000-0000-000000000012';
SQL
# Preserve the previous access regression suite with its original member fixture.
sql < supabase/tests/owl-55-access.sql
sql <<'SQL'
UPDATE public.group_members SET role='admin' WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id='00000000-0000-0000-0000-000000000005';
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000006');
SQL
sql < supabase/migrations/20261112044751_join_groups_by_invite_code.sql
sql < supabase/tests/owl-57-join.sql
sql < supabase/migrations/20261112044751_join_groups_by_invite_code.sql
sql < supabase/tests/owl-57-join.sql
sql < supabase/migrations/20261115035104_protect_purchase_changes.sql
sql < supabase/tests/owl-58-purchases.sql
sql < supabase/migrations/20261115035104_protect_purchase_changes.sql
sql < supabase/tests/owl-58-purchases.sql
sql <<'SQL'
-- Three edge cases plus 76 ordinary purchases: 79 total, as in live preflight.
UPDATE items SET purchased=true,purchased_by='00000000-0000-0000-0000-000000000002',purchased_at='2026-11-01T12:00:00Z' WHERE id='00000000-0000-0000-0000-000000000201';
UPDATE items SET purchased=true,purchased_by='00000000-0000-0000-0000-000000000001',purchased_at='2026-11-01T13:00:00Z' WHERE id='00000000-0000-0000-0000-000000000202';
UPDATE items SET purchased=true,purchased_by='00000000-0000-0000-0000-000000000003',purchased_at='2026-11-01T14:00:00Z' WHERE id='00000000-0000-0000-0000-000000000204';
INSERT INTO items(list_id,title,purchased,purchased_by,purchased_at)
SELECT '00000000-0000-0000-0000-000000000102','Preserved gift '||n,true,'00000000-0000-0000-0000-000000000001','2026-11-01T15:00:00Z' FROM generate_series(1,76) n;
CREATE TABLE public.purchase_privacy_expected AS SELECT i.id,i.purchased_by,to_jsonb(i)-'purchased_by' AS safe_record FROM items i;
CREATE PUBLICATION supabase_realtime FOR TABLE public.items;
SQL
# Prove inconsistent source data aborts without creating a half-migrated state.
sql <<'SQL'
UPDATE items SET purchased=true,purchased_at=now() WHERE id='00000000-0000-0000-0000-000000000203';
SQL
if failure_output=$(sql < supabase/migrations/20261115041100_privatize_purchase_buyers.sql 2>&1); then
 echo "Expected inconsistent purchase migration to fail" >&2
 exit 1
fi
if [[ "$failure_output" != *"Inconsistent purchase records"* ]]; then
 echo "$failure_output" >&2
 exit 1
fi
sql <<'SQL'
DO $$ BEGIN
 IF to_regclass('northlink_private.item_buyers') IS NOT NULL OR NOT EXISTS(
   SELECT 1 FROM pg_attribute WHERE attrelid='public.items'::regclass AND attname='purchased_by' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Failed migration did not roll back'; END IF;
END $$;
UPDATE items SET purchased=false,purchased_at=NULL WHERE id='00000000-0000-0000-0000-000000000203';
TRUNCATE purchase_privacy_expected;
INSERT INTO purchase_privacy_expected SELECT i.id,i.purchased_by,to_jsonb(i)-'purchased_by' FROM items i;
SQL
sql < supabase/migrations/20261115041100_privatize_purchase_buyers.sql
sql < supabase/tests/owl-58-privacy.sql
sql < supabase/tests/owl-58-graphql.sql
sql <<'SQL'
-- Mimic Supabase Auth claim resolution for real PostgREST requests.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
   nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
SQL
docker run --detach --rm --name "${container}-rest" --network "container:$container" \
  -e PGRST_DB_URI=postgresql://postgres@127.0.0.1:5432/postgres \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public \
  -e PGRST_JWT_SECRET=northlink-local-privacy-test-secret-not-a-real-credential \
  public.ecr.aws/supabase/postgrest:v14.14 >/dev/null
api_ready=false
for attempt in {1..30}; do
 if docker exec "$container" curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then api_ready=true; break; fi
 sleep 1
done
if [[ "$api_ready" != true ]]; then docker logs "${container}-rest"; exit 1; fi
node supabase/tests/purchase-privacy-api.cjs "$container"
sql <<'SQL'
-- Prepare an unclaimed gift for the same concurrent-claim checks as checkpoint 1.
DELETE FROM northlink_private.item_buyers WHERE item_id='00000000-0000-0000-0000-000000000201';
UPDATE items SET purchased=false,purchased_at=NULL WHERE id='00000000-0000-0000-0000-000000000201';
CREATE TABLE public.purchase_race_results(buyer uuid, outcome text);
GRANT INSERT ON public.purchase_race_results TO authenticated;
SQL
# Both sessions must complete. One claims; the other observes a conflict.
claim() {
  local buyer="$1"
  sql <<SQL
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','$buyer',true);
DO \$\$ BEGIN
  BEGIN
    PERFORM public.set_item_purchase('00000000-0000-0000-0000-000000000201',true);
    INSERT INTO public.purchase_race_results VALUES(auth.uid(),'won');
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    INSERT INTO public.purchase_race_results VALUES(auth.uid(),'lost');
  END;
END \$\$;
SELECT pg_sleep(1);
COMMIT;
SQL
}
claim 00000000-0000-0000-0000-000000000002 &
first=$!
claim 00000000-0000-0000-0000-000000000005 &
second=$!
wait "$first"
wait "$second"
sql <<'SQL'
DO $$ BEGIN
 IF (SELECT count(*) FROM purchase_race_results WHERE outcome='won')<>1 OR
    (SELECT count(*) FROM purchase_race_results WHERE outcome='lost')<>1
 THEN RAISE EXCEPTION 'Expected one winner and one conflict'; END IF;
 IF NOT EXISTS(SELECT 1 FROM items WHERE id='00000000-0000-0000-0000-000000000201'
 AND purchased AND purchased_at IS NOT NULL AND EXISTS(SELECT 1 FROM northlink_private.item_buyers b WHERE b.item_id=items.id AND b.buyer_user_id=(SELECT buyer FROM purchase_race_results WHERE outcome='won')))
 THEN RAISE EXCEPTION 'Concurrent purchase did not preserve a winner'; END IF;
END $$;
SQL
echo "OWL-58 private concurrent purchases passed"
