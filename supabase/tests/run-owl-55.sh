#!/usr/bin/env bash
# Runs only against a new, disposable container; never reads .env or hosted URLs.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="northlink-owl55-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" --network none \
  --user postgres --entrypoint sh public.ecr.aws/supabase/postgres:17.6.1.147 \
  -c "initdb -D /tmp/northlink-pg --auth=trust >/dev/null && exec postgres -D /tmp/northlink-pg -k /tmp -c listen_addresses=''" >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$container" pg_isready -h /tmp -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo "Test PostgreSQL did not become ready" >&2
  exit 1
fi
sql() { docker exec -i "$container" psql -h /tmp -X -q -U postgres -v ON_ERROR_STOP=1; }
sql < supabase/tests/owl-55-fixture.sql
sql < supabase/tests/owl-55-seed.sql
# Prove this fixture reproduces the original leak, rather than testing a
# database that was already secure.
sql <<'SQL'
SET ROLE anon;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.items) <> 4 THEN
    RAISE EXCEPTION 'Fixture did not reproduce anonymous item access';
  END IF;
END $$;
SQL
sql < supabase/migrations/20261112042611_restrict_gift_access.sql
sql < supabase/tests/owl-55-access.sql
echo "Reapplying migration to check repeatability"
sql < supabase/migrations/20261112042611_restrict_gift_access.sql
sql < supabase/tests/owl-55-access.sql
