#!/usr/bin/env bash
# Only a disposable local database; never uses .env or hosted URLs.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="northlink-owl57-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --detach --rm --name "$container" --network none \
  --user postgres --entrypoint sh public.ecr.aws/supabase/postgres:17.6.1.147 \
  -c "initdb -D /tmp/northlink-pg --auth=trust >/dev/null && exec postgres -D /tmp/northlink-pg -k /tmp -c listen_addresses=''" >/dev/null
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
# Two transactions claim the same invitation concurrently. Both must succeed
# while the primary key keeps exactly one membership.
sql <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
SELECT public.join_group_by_invite_code('ABCDEFGH');
SELECT pg_sleep(1);
COMMIT;
SQL
first=$!
sql <<'SQL' &
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000006',true);
SELECT public.join_group_by_invite_code('ABCDEFGH');
COMMIT;
SQL
second=$!
wait "$first"
wait "$second"
sql <<'SQL'
DO $$ BEGIN
  IF (SELECT count(*) FROM public.group_members WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id='00000000-0000-0000-0000-000000000006' AND role='member') <> 1
  THEN RAISE EXCEPTION 'Concurrent joins duplicated or elevated membership'; END IF;
END $$;
DELETE FROM public.group_members WHERE user_id='00000000-0000-0000-0000-000000000006';
UPDATE public.group_members SET role='member' WHERE group_id='00000000-0000-0000-0000-000000000011' AND user_id='00000000-0000-0000-0000-000000000005';
SQL
sql < supabase/tests/owl-55-access.sql
echo "OWL-57 concurrent joins and OWL-55 regression checks passed"
