#!/usr/bin/env bash
# Only a disposable local database; never uses .env or hosted URLs.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="northlink-owl80-reveal-$$"
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
sql < supabase/migrations/20261112044751_join_groups_by_invite_code.sql
sql < supabase/migrations/20261115035104_protect_purchase_changes.sql
sql < supabase/migrations/20261115041100_privatize_purchase_buyers.sql
sql < supabase/migrations/20261117070108_enable_item_thumbnails.sql
sql <<'SQL'
UPDATE items SET purchased=true,purchased_at='2026-11-17T12:00:00Z' WHERE id='00000000-0000-0000-0000-000000000201';
UPDATE items SET purchased=true,purchased_at='2025-12-24T12:00:00Z' WHERE id='00000000-0000-0000-0000-000000000202';
INSERT INTO northlink_private.item_buyers(item_id,buyer_user_id) VALUES
 ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000005');
CREATE TABLE public.owl80_items_before AS SELECT to_jsonb(i) FROM items i;
CREATE TABLE public.owl80_buyers_before AS SELECT to_jsonb(b) FROM northlink_private.item_buyers b;
CREATE TABLE public.owl80_purchase_function_before AS SELECT pg_get_functiondef('northlink_private.set_item_purchase(uuid,boolean)'::regprocedure) AS definition;
CREATE TABLE public.owl80_feed_before AS SELECT pg_get_functiondef('northlink_private.get_my_purchases()'::regprocedure) AS definition;
SQL
sql < supabase/migrations/20261117082154_timed_buyer_reveal.sql
sql < supabase/tests/owl-80-reveal.sql
echo "Timed buyer reveal SQL checks passed"

# The SQL boundary tests rolled back their clock substitution. Exercise the real
# production clock and wrapper over the REST API with valid local test JWTs.
sql <<'SQL'
DO $$ BEGIN
 IF position('pg_catalog.statement_timestamp()' IN pg_get_functiondef('northlink_private.get_list_buyer_reveal(uuid)'::regprocedure))=0
 THEN RAISE EXCEPTION 'Production server clock was not restored'; END IF;
END $$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
  nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
UPDATE items SET purchased_at=make_timestamptz(EXTRACT(YEAR FROM statement_timestamp() AT TIME ZONE 'America/New_York')::int+1,11,1,12,0,0,'America/New_York') WHERE id='00000000-0000-0000-0000-000000000201';
UPDATE items SET purchased_at=make_timestamptz(EXTRACT(YEAR FROM statement_timestamp() AT TIME ZONE 'America/New_York')::int-1,11,1,12,0,0,'America/New_York') WHERE id='00000000-0000-0000-0000-000000000202';
SQL
test_key="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
docker run --detach --rm --name "${container}-rest" --network "container:$container" \
 -e PGRST_DB_URI=postgresql://postgres@127.0.0.1:5432/postgres \
 -e PGRST_DB_ANON_ROLE=anon -e PGRST_DB_SCHEMAS=public \
 -e PGRST_JWT_SECRET="$test_key" \
 public.ecr.aws/supabase/postgrest:v14.14 >/dev/null
api_ready=false
for attempt in {1..30}; do
 if docker exec "$container" curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then api_ready=true; break; fi
 sleep 1
done
if [[ "$api_ready" != true ]]; then docker logs "${container}-rest"; exit 1; fi
OWL80_TEST_JWT_SECRET="$test_key" node supabase/tests/buyer-reveal-api.cjs "$container"
