#!/usr/bin/env bash
# Only a disposable local database; never uses .env or hosted URLs.
set -euo pipefail
cd "$(dirname "$0")/../.."
container="northlink-owl58-$$"
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
sql < supabase/migrations/20261115035104_protect_purchase_changes.sql
sql < supabase/tests/owl-58-purchases.sql
sql < supabase/migrations/20261115035104_protect_purchase_changes.sql
sql < supabase/tests/owl-58-purchases.sql
sql <<'SQL'
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
 AND purchased AND purchased_by=(SELECT buyer FROM purchase_race_results WHERE outcome='won') AND purchased_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Concurrent purchase did not preserve a winner'; END IF;
END $$;
SQL
echo "OWL-58 concurrent purchases passed"
