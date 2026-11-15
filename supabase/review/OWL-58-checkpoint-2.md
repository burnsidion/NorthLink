# OWL-58 checkpoint 2: private buyer identities

Prepared November 14, 2026 (America/Denver). Local changes only; CyberSanta has
not been updated by this checkpoint.

## Result

- public.items retains purchased and purchased_at, but no purchased_by column.
- Buyer mappings live in northlink_private.item_buyers. It has row security
  enabled, no client policies, and no client table grants. It is not published
  to Realtime and must remain outside the exposed Data API schemas.
- The existing purchase API keeps its signature and safe response. It locks the
  item and atomically changes the private buyer mapping and public purchase state.
  One shopper wins; retries preserve the timestamp; only the buyer can cancel.
- My Purchases uses a no-argument API that checks session identity and current
  list access. It returns screen fields for the caller's own purchases, never
  another buyer's records or a buyer ID. Caller-supplied identity is not accepted.
- The screen now shows loading failures instead of treating them as empty history.

Existing purchases whose buyers no longer have sharing access remain preserved
privately but do not grant new access to the list or My Purchases details.
Owner self-purchases remain available to that owner through My Purchases.

## Preservation and reveal

The migration locks items against concurrent writes, rejects inconsistent source
records, copies buyer mappings, and verifies exact equality before dropping the
old column. It does not change purchase flags, timestamps, or gift details.
Unexpected dependencies stop the migration: no DROP CASCADE is used.

Buyer records are available for a later authorized Christmas-reveal read path.
There is no date check, scheduling, reveal UI, or speculative scaffold here.
Existing deletion behavior remains: deleting a gift/list cascades to its active
buyer mapping. Retention for deleted gifts must be decided before a reveal or
purchase-history feature is implemented. Cancellation clears the active mapping.

## Validation

Run from the repository root:

```sh
bash supabase/tests/run-owl-58-privacy.sh
node --test supabase/tests/purchases-api.test.cjs supabase/tests/purchase-client.test.cjs
npx tsc --noEmit --incremental false
npm run build
```

The Docker suite uses only fake records. It publishes no ports, mounts no
persistent volume, reads no .env, and makes no hosted requests. PostgreSQL and
PostgREST share an isolated network namespace and use loopback only; both
containers are removed on exit. Required images:

- public.ecr.aws/supabase/postgres:17.6.1.147
- public.ecr.aws/supabase/postgrest:v14.14

Checks passed:

- Prior access/invitation/purchase regression tests.
- Exact preservation of 79 synthetic purchases, including owner self-purchases
  and a buyer who lost access; all public gift data and timestamps unchanged.
- Deliberately inconsistent source data rejects the migration, rolls back, and
  leaves the old column intact with no partially created buyer table.
- Owners, shoppers, unrelated users, and signed-out callers cannot read/write
  private mappings; owners still see status; own-history access obeys sharing.
- Cancellation, retry, unsharing, ordinary edits/deletion, and concurrent claims
  keep the checkpoint-1 rules. Independent sessions produce one winner/conflict.
- Real local PostgREST calls: ordinary rows omit buyer identity; old-column
  filters fail; private schema requests fail; no-argument own-history succeeds;
  spoofed identity and anonymous own-history requests fail.
- pg_graphql introspection and queries expose no buyer fields/table. Introspection
  is enabled only in the disposable fixture to audit reflection, not by migration.
- Realtime publication metadata excludes private mappings and the removed field;
  serialized public rows contain no buyer identity. A running Realtime websocket
  service was not exercised, so verify subscriptions after deployment.
- Thirteen client tests pass, covering the new own-history helper plus existing
  purchase/checkbox behavior. TypeScript and production build pass. New-helper
  ESLint passes; the modified page retains three existing errors/one warning
  (previously seven errors/one warning). Existing build warnings remain.

These tests use local stand-ins for Auth claims and do not test the hosted
gateway or an actual browser session.

## Rollout — separate explicit approval required

1. Review this migration; recheck source consistency, relevant live definitions,
   backup availability, and exposed schemas. Current read-only preflight found
   79 complete purchases and no existing private buyer table.
2. Apply only 20261115041100_privatize_purchase_buyers.sql after checkpoint 1.
   Do not replay earlier migrations: checkpoint 1 references the removed column.
   Connected-tool history versions differ from local filenames; reconcile those
   deliberately before any later CLI migration push.
3. Coordinate immediate deployment of this matching client. The old My Purchases
   screen filters by the removed column and will fail between database migration
   and deployment. Other gift reads and the existing purchase API remain usable.
4. Verify private row count/mappings and unchanged public purchase totals through
   trusted aggregate checks, signed-out permissions, API discovery, GraphQL/schema
   refresh, and advisors. Never print buyer IDs or real gift details in the chat.
5. Smoke-test My Purchases and claim/cancel with approved test accounts and gifts,
   and confirm owner screens/live updates contain no buyer field.

The migration is transactional. Errors before COMMIT preserve the original
state. After COMMIT, fix forward; do not roll back to checkpoint-1 SQL or recreate
the exposed buyer column. If the client deployment fails, keep ordinary gift
reads/purchase operations available and repair My Purchases without reopening
identity access. Existing backup restore is a last-resort recovery path because
it can roll back unrelated user activity.

Nothing retroactively removes information clients may have received before the
privacy boundary was introduced.
