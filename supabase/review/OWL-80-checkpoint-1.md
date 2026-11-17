# OWL-80 checkpoint 1 — timed buyer reveal backend

Checkpoint 1 was implemented locally on `feat/OWL-80-Timed_Buyer_Reveal`. The completed migration was subsequently applied to CyberSanta with explicit approval; see checkpoint 2 for live verification and the pending UI click-through. No commits, pushes, PR or Linear edits.

## Release rules

- Release at **December 26, 00:00 Eastern time**, using the explicit `America/New_York` zone. For Christmas 2026 this is `2026-12-26T05:00:00Z`.
- Derive each gift's Christmas season from its authoritative `purchased_at` timestamp in Eastern time, not `lists.year`. Read-only preflight found most lists still tagged 2025, so using the list year would risk exposing a 2026 purchase early.
- Purchases on December 26–31 reveal immediately when read. Purchases from January 1 Eastern belong to the next season. Previously revealed purchases stay revealed across New Year.
- Historical 2025 purchases are already eligible; their cutoff has passed. Preflight found 67 purchased gifts dated 2025 and one dated 2026 at investigation time. No purchase timestamps or list years are rewritten.
- Missing/nonfinite purchase timestamps fail closed. A future-dated purchase does not reveal before its own purchase time.
- Only the actual list owner can obtain this response. Shared members, buyers who do not own the list, unrelated accounts, nonexistent caller IDs and anonymous callers cannot.
- A caller cannot supply a clock, owner or season. Before the cutoff, no buyer name or identity is returned; after it, only the current display name is returned. Raw buyer IDs/email/avatar URLs stay excluded.
- Cancellation removes the reveal entry. A new claim uses its new buyer and purchase timestamp. Owner visibility does not grant the right to undo somebody else's purchase.

## Migration / API contract

`supabase/migrations/20261117082154_timed_buyer_reveal.sql`

Adds a private cutoff helper, a narrowly scoped private lookup, and a public invoker wrapper. Existing item rows, private buyer mappings, public table grants, RLS, purchase writes, purchases feed and Realtime setup are unchanged. Private buyer data remains inaccessible directly.

Client call for checkpoint 2:

```ts
supabase.rpc('get_list_buyer_reveal', { p_list_id: listId })
```

Response:

```ts
{
 server_time: string; // authoritative server timestamp
 timezone: 'America/New_York';
 items: Array<{
  item_id: string;
  purchased_at: string | null; // added in checkpoint 2 to bind labels to a claim
  reveal_at: string | null;
  revealed: boolean;
  buyer_name: string | null; // null before cutoff; safe fallback if name unavailable
 }>;
}
```

Only purchased gifts from the owned list appear. Empty lists return an empty items array. Unauthorized or missing lists raise SQLSTATE 42501. No scheduler or persisted release flag is needed; fresh reads reevaluate server time.

## Validation

`npm run test:db:reveal` runs only disposable local Postgres/PostgREST containers; it does not load hosted environment credentials. It generates an ephemeral random JWT signing key, then removes the containers on exit.

Passed:
- Exact SQL RPC at one microsecond before the cutoff, exactly at the cutoff, and after it.
- Summer purchase timestamp, explicit Eastern conversion with a different database timezone, UTC/Eastern New Year boundary, old list year, late purchases, permanently visible historical purchases and next-season privacy.
- Cancellation, buyer reassignment through a new purchase, safe missing display-name fallback, owner-only access, all unauthorized roles, direct private-table/helper denial and protected timestamp writes.
- Preservation of populated gift/buyer records and byte-for-byte unchanged existing purchase and feed function definitions across migration.
- Function ACL/search-path checks: invoker public wrapper; definer lookup only in private schema with empty search path; no anonymous execution; no client execution of the pure helper.
- Actual REST API requests for owner-hidden/current-future season versus owner-revealed/past season, denied other callers, spoofed clock/owner/season parameters, hidden private schema and unchanged buyer purchases feed.
- Existing 136-unit-test suite and TypeScript checks. Existing purchase/privacy regression suite also run separately.
- Shell/Node syntax and whitespace checks. No app build needed for this database-only checkpoint.

The SQL boundary fixture temporarily substitutes only the private lookup's server clock inside a rollback-only transaction. There is no production clock override parameter or function. The API runner asserts that the original `statement_timestamp()` definition was restored before testing the real API.

## Security advisor baseline (existing hosted notices)

No hosted DDL has been applied. Local function ACL/search-path assertions cover the newly added routines. The required private definer lookup deliberately checks auth and ownership before accessing buyers; granting it to authenticated callers is necessary for the invoker wrapper and may produce an expected authenticated-definer advisory after deployment.

Pre-existing hosted notices remain a separate audit, not a claim of new exploitation:
- Private buyer table has RLS with no direct-access policy (intentional deny-all): https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Existing accessible-lists definer view: https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view
- Eight older routines with mutable search paths: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable
- Older executable definer helpers: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked-password protection disabled: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Implementation references: https://supabase.com/docs/guides/database/functions and https://www.postgresql.org/docs/17/functions-datetime.html . Checked the current Supabase changelog; no SDK upgrade or hosted CLI operation is part of this change.

## Checkpoint 2

Pending review: fetch these owner-only details on the existing list page; add Purchased by labels and a small nonblocking notice; refresh at/after cutoff and after purchase changes without using the device clock as disclosure authority; handle missing/stale/error responses without showing an incorrect buyer. Apply the hosted migration only after separate authorization, before deploying the consuming UI.
