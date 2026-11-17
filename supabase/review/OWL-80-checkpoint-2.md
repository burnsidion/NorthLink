# OWL-80 checkpoint 2 — list-page buyer reveal

Completed locally; hosted migration applied to CyberSanta with explicit user approval on November 17, 2026. Hosted history records `20261117085739_timed_buyer_reveal` (the tool assigns the application timestamp). The first attempt did not execute because the approval review hit a usage limit; retry succeeded after the user reset it. Nothing committed, pushed or edited in Linear.

## Behavior

- Existing list page shows **Purchased by [display name]** below purchased gifts, exclusively for the list owner. No new production page or popup.
- A small inline notice explains when names are available, or displays the next release date in Eastern time. Mixed seasons can show released names alongside a future release notice.
- RPC calls send only the list ID; the database verifies ownership and time. Non-owners and lists without purchases do not start buyer lookups.
- The existing purchase RPC/undo permissions are unchanged. Seeing a name does not let an owner cancel somebody else's purchase.
- If the reveal lookup fails or times out, clear the buyer names, show a nonblocking error and Retry buyer details, and leave the gift list usable.
- Recheck every 30 seconds while visible, on focus/online/visibility return, and near the next server-provided release deadline. Timers only request new server data; the device clock cannot unlock names. No lookup while hidden.
- List items also refresh on focus/online/visibility return, in addition to existing item Realtime events. Confirmed purchase timestamps change the reveal request scope automatically.

## Claim freshness / API contract refinement

The unapplied migration now also returns each gift's already-public `purchased_at` timestamp. The client matches gift ID **and exact purchase timestamp**, preserving Postgres microseconds while normalizing offsets. A canceled/re-purchased gift cannot inherit a cached previous buyer label. Old list/account requests, older refreshes and late replies after timeout/unmount are discarded.

Only documented response fields reach client state. Invalid responses, hidden rows containing a name, duplicate gift IDs, invalid timestamps, wrong timezone or a revealed name preceding its server-provided cutoff are rejected. No names are inferred from a browser timer.

## Files

- `src/lib/buyer-reveal-api.ts`: validated owner-only RPC client and timestamp identity helper.
- `src/lib/use-list-buyer-reveal.ts`: scoped/cancelable reads, deadline checks, retries and lifecycle cleanup.
- `src/components/items/buyer-reveal-notice.tsx`: inline notice/error UI.
- `src/components/items/item-row.tsx`: owner-only buyer label.
- `src/app/(authed)/lists/[id]/page.tsx`: integration and focus/reconnect item refreshes. Added typed owner field to ListRow and removed its old `any` owner cast.
- `src/app/globals.css`: restrained notice and label styles with mobile wrapping.

Existing local copy/formatting edits in landing, login, My Lists and the removed list-page eyebrow were preserved. They are separate from this implementation.

## Validation

- Full unit suite: **150 tests**, including new RPC validation, microsecond identity matching, owner/non-owner page wiring, hidden-before-release behavior, incorrect device clock, next-cutoff recheck, changed claim/list/account, canceled purchases, same-claim out-of-order refresh, failed refresh/retry, transport timeout, unmount cleanup, hidden-tab polling and notice formatting.
- Re-ran disposable SQL/PostgREST tests with the refined timestamp response. Exact Eastern midnight and privacy tests passed; no hosted changes.
- Typecheck, targeted ESLint, production build, syntax and whitespace checks passed.
- Browser preview used the real notice and gift-row components with explicitly simulated phases. Confirmed before-release names absent; after-release labels present; failed lookup notice/retry works; family-member view omits names and owner notice.
- 390px phone preview had no horizontal overflow. Long buyer name wrapped within the page (right edge 333px within a 390px viewport).
- Removed the temporary preview route and generated references before the final build. Stopped only the preview server started for this checkpoint.
- The hosted migration is now applied; the signed-in UI click-through remains pending. No production clock overrides or demo controls are shipped.

Screenshots:
- `/Users/cthulhusrealm/.codex/visualizations/2026/11/12/01a1cdf1-9d86-7ec2-84d8-2ed2860532ba/owl80-buyer-reveal-desktop.jpg`
- `/Users/cthulhusrealm/.codex/visualizations/2026/11/12/01a1cdf1-9d86-7ec2-84d8-2ed2860532ba/owl80-buyer-reveal-mobile.jpg`

## Release order

1. Done: applied the prepared hosted migration with approval and verified the cutoff, real server clock, pinned private search path, invoker wrapper, authenticated execution, anonymous denial and continued private-table/helper denial. Post-apply security advisor counts matched the documented preflight baseline.
2. Check the signed-in owner list and a non-owner view. Historical purchases can reveal immediately; current-season purchases remain private until December 26, midnight EST.
3. User commits/pushes and deploys the app through the usual PR flow.
