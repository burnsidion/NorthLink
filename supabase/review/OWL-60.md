# OWL-60: consistent sign-in and profile setup

Both implementation checkpoints are complete locally. Live browser verification remains pending.
No migration, dependency upgrade, hosted setting change, or real-user modification is included.

## Checkpoint 1

- Root navigation and protected direct links share the same name/avatar completeness check.
- Failed lookups block entry with retry rather than impersonating a missing profile.
- Setup uses a real default avatar, confirms persistence, prevents duplicate saves,
  retains edits after failures, and ignores late results after account changes/navigation.

## Checkpoint 2

- Browser storage remains the session owner. The existing `/api/auth/callback` and
  `/api/logout` addresses now serve browser pages rather than server handlers.
  Keeping these addresses avoids a redirect allowlist change for this release.
- Email callbacks wait for Supabase initialization, validate the user/profile, then
  send incomplete profiles to setup and complete profiles to an allowed app page.
- `next` accepts known signed-in pages and UUID list URLs only; query strings,
  fragments, external destinations and auth/logout loops are discarded.
- Callback failures show generic recovery instructions. Callback parameters are
  removed from the address bar after completion/failure; provider details are not rendered.
- Existing implicit email links remain supported. Code-only links are rejected
  rather than silently succeeding via an old session. Moving to PKCE or server cookies
  would be a separate change.
- Login validates existing sessions before redirecting. Known invalid/expired sessions
  leave sign-in available; network/provider failures offer retry.
- The dock navigates normally to the browser logout page. That page awaits sign-out,
  shares concurrent attempts, and offers retry on failure. Existing all-device logout
  behavior is preserved explicitly.
- Removed unreferenced server list/item actions and `createSupabaseServer`, which
  previously returned the browser singleton. Repository searches found no consumers;
  active UI writes still use their existing browser helpers and database policies.

## Validation

- `node --test supabase/tests/*.test.cjs`: 46 passing tests.
- `npx tsc --noEmit`: passed.
- Production build: passed. Stale generated development route types were cleared
  after the handler-to-page conversion; no configuration change was needed.
- ESLint on changed TypeScript/TSX files: no errors or warnings.
- `git diff --check`: passed.
- New tests exercise redirects, failures, retries, stale completions, expired sessions,
  logout concurrency and actual SDK email-link persistence/logout with a fake transport.
  They do not prove hosted email delivery or redirect configuration.

## Before merge: live browser checks

1. Open a protected direct link while signed out; confirm it sends you to sign-in.
2. Sign in with an existing complete profile; confirm landing and direct links work.
3. Register a temporary account using an email inbox you control. Open its fresh
   confirmation link; confirm profile setup appears and saving opens the app.
4. Open an expired confirmation link; confirm recovery instructions, with no provider
   details exposed. Code-only links are not the app's supported email-link format.
5. Use Sign out on desktop and mobile; refresh/open a protected direct link and
   confirm sign-in is required. Note logout keeps its existing all-device scope.
6. Interrupt the connection during sign-in/profile lookup/logout; confirm failures
   are visible and retries work after reconnection. An interrupted initial email-link
   exchange may require requesting a fresh link, as the recovery message explains.

Preview sign-in may depend on the project's existing redirect allowlist. This work
has not changed or verified those hosted settings; report that separately if the
fresh email-link test fails.
