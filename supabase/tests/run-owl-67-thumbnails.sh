#!/usr/bin/env bash
# Only a disposable local database; never uses .env or hosted URLs.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="northlink-owl67-thumbnails-$$"
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
# Invalid legacy data must abort without deleting or silently replacing it.
sql <<'SQL'
UPDATE items SET image_url='http://legacy.example/image.jpg' WHERE id='00000000-0000-0000-0000-000000000201';
SQL
if sql < supabase/migrations/20261117070108_enable_item_thumbnails.sql >/dev/null 2>&1; then
 echo "Expected invalid legacy image to stop migration" >&2; exit 1
fi
sql <<'SQL'
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conname='items_image_url_https') OR
 (SELECT image_url FROM items WHERE id='00000000-0000-0000-0000-000000000201') <> 'http://legacy.example/image.jpg'
 THEN RAISE EXCEPTION 'Failed migration changed data or left a constraint'; END IF;
END $$;
UPDATE items SET image_url=NULL WHERE id='00000000-0000-0000-0000-000000000201';
SQL
sql < supabase/migrations/20261117070108_enable_item_thumbnails.sql
sql < supabase/tests/owl-67-thumbnails.sql
echo "Thumbnail database checks passed"
