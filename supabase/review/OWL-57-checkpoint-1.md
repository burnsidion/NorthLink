# OWL-57 checkpoint 1: safe family invitations

Prepared November 11, 2026 (America/Denver). Hosted CyberSanta is unchanged.

## Behavior

- Join using the existing eight-character invite code, ignoring surrounding
  whitespace and letter case. Long group IDs are no longer invitations.
- The database takes identity from the signed-in session and assigns member.
  The API accepts no user ID, role, or group ID.
- Repeating a join is safe, including concurrent requests. Existing owner/admin
  roles are preserved. Existing memberships and invite codes are not rewritten.
- Multiple memberships remain supported in the database; the current UI still
  displays one group. The multiple-family screens are a later checkpoint.
- The family panel copies/displays the actual short code and shows inline
  feedback for join, create, load, and clipboard failures.

## Permission boundary

Direct membership INSERT and UPDATE are revoked for clients and their old
policies removed. This includes direct owner/admin edits: there is no role editor
in the current application. A future role-management feature must have its own
reviewed permission path. Existing SELECT/DELETE rules are unchanged; the
self-referencing deletion/admin rules still need the next checkpoint.

public.join_group_by_invite_code is an unprivileged wrapper around a narrowly
privileged function in northlink_private. The private function needs access to
look up an invitation before the person belongs to the group. It uses an empty
search path, fully qualified tables, session identity, account-existence and
input checks, and inserts only member. It never returns invite codes or other
users' records. Both functions deny anonymous/PUBLIC execution and grant only
authenticated execution. Keep northlink_private outside Data API exposed schemas.

The existing group-creation function still inserts its owner. Its search path
is fixed and anonymous/PUBLIC execution removed. No broad new table grants or
service credentials are added.

Reference: [Supabase database function security](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker).

## Validation

From the repository root:

```sh
bash supabase/tests/run-owl-57.sh
node --test supabase/tests/family-group-helpers.test.cjs
npx tsc --noEmit --incremental false
npx eslint src/lib/family-group-helpers.ts src/components/family/family-group-panel.tsx
```

The Docker runner uses the captured OWL-55 structure and fake records in a
network-isolated PostgreSQL 17 container, with no ports or persistent volume.
It loads OWL-55, runs its regression suite, checks OWL-57, reapplies OWL-57,
checks it again, tests concurrent joins in separate transactions, and reruns
OWL-55. The container is removed on exit. It does not read .env or hosted URLs.

Coverage: invalid/missing/old-format codes, unknown accounts, signed-out callers,
hidden group data before joining, successful normalized codes, duplicate and
concurrent joins, membership-role preservation, direct-write rejection, second
group joins, group creation/owner membership, and function privilege settings.
Six helper tests cover normalized requests, rejected inputs, backend/network
failures, malformed responses, actual code display data, and load failures.

Validation passed: SQL suite including concurrent joins and OWL-55 regressions,
six helper tests, changed-file ESLint, TypeScript, whitespace checks, and the
production build using locked Next.js 16.0.10 dependencies. Existing dependency
warnings remain (the Three.js React peer version, deprecated Supabase auth helper
packages, images.domains configuration, baseline-browser data, and punycode).
They were not expanded into unrelated changes here.

These SQL tests use stand-ins for Auth identities. They do not replace a full
browser/Auth/PostgREST test. No real family data is changed.

## Application order — separate explicit approval required

The live read-only preflight found no missing or malformed group invite codes.
Recheck this and the relevant policies/functions/grants before application;
abort and re-scope if they have drifted.

1. Review and apply OWL-55 first if still pending.
2. Confirm backups and a recovery path, and confirm northlink_private is not an
   exposed Data API schema.
3. Apply only 20261112044751_join_groups_by_invite_code.sql as a transaction.
   Do not replay every repository migration against the live database.
4. Deploy the client change only after the RPC exists. The old client sends
   direct inserts, so joins will fail between database application and client
   deployment; coordinate the two changes rather than leaving that gap open.
5. Smoke-test with approved test accounts, check API schema reload, and run
   Supabase advisors. Existing unrelated advisor findings remain.

The migration does not rewrite user data. A failure before COMMIT rolls back.
After COMMIT, repair forward; do not restore permissive membership writes to
get an old client working. If the rollout must stop, keep joins unavailable until
the compatible client is ready. Do not remove existing family memberships.

## Deferred

Sharing destination validation, membership deletion/admin policy cleanup,
multiple-family screens, invite rotation/revocation, and application-level
join-attempt rate limiting are outside this checkpoint. Existing short-code
generation is retained. OWL-58 buyer privacy/purchase integrity is unchanged.
