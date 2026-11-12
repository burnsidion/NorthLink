# OWL-55: restrict gift access

Prepared on November 11, 2026 (America/Denver) for CyberSanta.
**Not applied to the hosted project.**

## What changes

- Lists and gifts are readable by their owner or a member of a group with an explicit share.
- Signed-out requests cannot read gifts or update them. Signed-out access to the two metadata views is revoked.
- Gift updates check access to both the existing and destination list.
- Unsharing removes access to list rows, gifts, list metadata, totals, and updates.
- Existing item creation/deletion ownership rules are retained.
- Family-list metadata retains its existing columns, including the owner's name/avatar and the caller's shared_user_id.

## Intentional privileged view

v_user_accessible_lists intentionally retains postgres ownership and
security_invoker=false. Profiles only permits self-reads; using caller permissions
here would hide other list owners' names and avatars. A direct lists/shares policy
chain also recurses during unsharing because share deletion checks list ownership.

The view restricts its membership join to auth.uid(), rejects a missing identity,
and returns only owned or explicitly shared lists. security_barrier prevents
caller predicates being pushed inside that boundary. Authenticated users have
SELECT only; anon/PUBLIC have no privileges. The lists policy independently
matches shared_user_id to auth.uid(); item policies read through lists' RLS.
No new privileged functions or broader profile policies are introduced.

The Supabase security advisor will still flag this intentionally privileged
metadata view. That warning is **not** fully eliminated in this checkpoint.
list_progress now uses caller permissions instead.

## Review artifacts

- owl-55-before.json: structure-only capture of public columns, policies, views,
  SQL/PLpgSQL functions, anon/authenticated table grants, constraints, and triggers.
  No user rows, tokens, or credentials. This is a scoped review snapshot, not a
  complete backup or a production bootstrap.
- ../migrations/20261112042611_restrict_gift_access.sql: generated migration name,
  followed by the reviewed SQL. No table data is rewritten or deleted.
- ../tests/: captured-schema fixture, fake users/gifts, and permission assertions.
  The fixture uses minimal auth.users/auth.uid stand-ins and omits unrelated
  Supabase platform services, extensions, and complete grant reconstruction.

## Local validation

Run from the repository root:

```sh
bash supabase/tests/run-owl-55.sh
```

Requires Docker and public.ecr.aws/supabase/postgres:17.6.1.147
(Docker may download it if absent).
The script starts a uniquely named container, publishes no ports, disables its
network, uses no persistent volume, and removes the container on exit. It never
loads .env files or accepts a hosted connection URL.

It first reproduces the original anonymous read leak, applies the migration,
checks the access matrix, reapplies the migration, and reruns the checks.
Coverage includes signed-out callers, a role with no identity, unrelated users,
owners, shoppers, different groups, multiple groups, owner names, purchases,
owner item edits/additions/deletions, forbidden destination lists, and unsharing.

Validated on PostgreSQL 16.11 and the Supabase PostgreSQL 17.6 image; the
repeatable runner uses PostgreSQL 17, matching CyberSanta's major version.
This checks real SQL permission behavior, but is not a full
Supabase/PostgREST/Auth or browser integration test. TypeScript checking also passes. Existing lint failures
from the initial review were not addressed by this database-only change.

## Hosted application requires separate approval

1. Re-read the affected live definitions and compare with the snapshot. Re-scope
   if policies, view ownership, grants, dependencies, or schema have drifted.
2. Confirm a usable backend backup/recovery path and review the exact SQL.
3. Apply only this migration in one transaction after explicit approval.
   Do not blindly run all repository migrations: the older file is a partial,
   historical patch and the hosted project has no recorded migration history.
4. Run read-only signed-out and scoped-user checks; smoke-test owner lists,
   family lists, purchase totals, and unsharing using approved test accounts.
   Run Supabase advisors and review the intentional view warning above.
5. Record deployment/migration history deliberately; migration-history repair
   and hosted writes are not authorized by this local checkpoint.

The SQL is transactional: a failure before COMMIT leaves the prior state intact.
After a successful commit, do not restore the old permissive rules as a rollback;
that would reopen the leak. If a regression occurs, obtain approval to temporarily
restrict affected client access and apply a narrow forward fix. Preserve data;
do not delete gifts or recreate tables to recover.

## Remaining issues

- OWL-57: membership self-join/role escalation. Someone who obtains a group ID
  can still exploit the existing membership rules; this fix does not secure that
  entry point.
- OWL-58: buyer identity, shopper field restrictions, cancellation rights, and
  atomic claims remain unchanged. Authorized list readers can still query buyer
  references, and authorized shoppers can modify more fields than intended.
- Existing legacy families/claims structures and public functions are unchanged.
- No UI changes, dependency updates, commits, pushes, PRs, Linear updates, hosted
  migrations, or hosted writes belong to this checkpoint.
