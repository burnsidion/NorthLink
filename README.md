# NorthLink / CyberSanta

A Christmas wish-list app for sharing gift ideas with family. List owners can see
which gifts are purchased, while the buyer stays private. Only the buyer can undo
a purchase.

## Run locally

Requirements: Node.js **20.9 or newer**, npm, and access to a configured Supabase
project. The minimum Node version comes from the installed Next.js version.

```bash
npm ci
```

Create `.env.local` in the repository root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key
```

These are browser-visible settings. Never put a service-role key, secret key,
database password, or user token in a `NEXT_PUBLIC_` variable. Do not commit `.env.local`.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). For the production build locally:

```bash
npm run build
npm start
```

The build fetches the existing Google font and needs internet access. Vercel needs
the same public Supabase settings. Email confirmations use
`/api/auth/callback` on the app's origin; local or preview confirmation tests also
depend on the project's hosted redirect allowlist. Running locally can still
read and change hosted family data if `.env.local` points at that project.

## Checks

| Command | Purpose | Requirements |
| --- | --- | --- |
| `npm run check` | Type checking, then the JavaScript tests | Installed dependencies |
| `npm test` | Node's built-in tests for helpers, screen behavior, retries and failure handling | No hosted credentials or Docker |
| `npm run typecheck` | TypeScript validation | Installed dependencies |
| `npm run test:db` | Existing isolated database and API permission/privacy regressions | Running Docker; images downloaded on first use |
| `npm run lint` | Full lint report, including known existing findings | Installed dependencies |
| `npm run build` | Production compilation and page generation | App environment settings and internet access |

`check` intentionally runs type checking and JavaScript tests only. It does not
include the build, Docker checks, browser testing, or full lint. Full lint still
exits unsuccessfully until its existing findings are addressed; see the
[OWL-62 review and triage](supabase/review/OWL-62.md).

The JavaScript tests use mocked requests and deterministic screen/hook harnesses,
plus a real Supabase Auth SDK test with fake transport and browser storage. They
exercise behavior but do not replace a real browser or hosted sign-in test.

`test:db` runs `supabase/tests/run-owl-58-privacy.sh`. It creates disposable local
PostgreSQL and PostgREST containers with fake users and gifts, then removes them.
It does not read `.env.local`, contact CyberSanta, apply hosted migrations, publish
ports, or create persistent database volumes. It covers signed-out and unrelated
users, invitation joins, owner/shopper permissions, purchase conflicts, buyer
privacy, REST/GraphQL access and migration preservation. The older ticket-specific
runners remain available for narrower investigation.

Before merging behavior changes, run the relevant automated checks and a focused
browser check. In particular, a purchase change made by one account should update
the other account's list totals without revealing the buyer. OWL-61's two-account
check remains pending until someone performs it; automated checks do not establish
that hosted live events were delivered.

## How the app is arranged

- `src/app/(authed)/`: landing, own lists, family lists, list detail and purchases.
- `src/app/login/` and `src/app/onboarding/`: sign-in and profile setup.
- `src/app/api/auth/callback/page.tsx` and `src/app/api/logout/page.tsx`: browser
  pages at the existing callback/logout addresses, despite their `/api/` paths.
- `src/components/`: forms, cards, navigation and shared UI.
- `src/lib/`: browser data helpers, validation, authentication and refresh behavior.
- `src/types/db.ts`: manually maintained screen/database row types, not a complete
  generated schema contract.
- `supabase/migrations/`: historical database patches.
- `supabase/tests/`: isolated database fixtures and JavaScript tests.
- `supabase/review/`: scoped review notes and rollout cautions.

Authentication uses Supabase email/password sign-in with email confirmation.
Sessions are persisted in browser storage using the existing implicit flow. The
profile gate directs signed-out users to login and incomplete profiles to setup;
it is a navigation check. Database policies enforce access to the data. There is
no request-scoped server Supabase client or active `src/app/actions/` layer.

Pages handle screen state; helpers perform data operations; database policies and
purchase functions enforce permissions. Purchase writes use `set_item_purchase`;
Purchased Gifts reads use `get_my_purchases`, which identifies the caller in the
backend. Keep buyer identity and authorization decisions out of client-supplied
fields.

## Data and privacy

The app uses `profiles`, `groups`, `group_members`, `lists`, `list_shares`, `items`
and supporting views/functions. Public gift rows contain purchase status/time,
prices, links, notes and flags. Buyer identity is stored separately in
`northlink_private.item_buyers`; `items.purchased_by` was removed. The private
buyer table is not exposed through the public Data API.

The migrations directory is **not a complete database bootstrap**. Do not apply
all its files blindly to a new or hosted project. Test fixtures stand in for the
historical schema and Auth claims; they are not production setup instructions.
See [OWL-55](supabase/review/OWL-55.md),
[OWL-58 purchase privacy](supabase/review/OWL-58-checkpoint-2.md), and
[OWL-60 authentication](supabase/review/OWL-60.md) for the context of those changes.
Historical review notes describe their checkpoint's state, not necessarily the
current hosted project's state.

My Lists, Family Lists and Purchased Gifts refresh after relevant database events,
on returning to the tab, on reconnection and every 30 seconds while visible. A
failed refresh retains the previous data and warns that it may be stale. The
refresh queries do not fetch buyer identity.

Gift URLs open through ordinary HTTP/HTTPS links. They are not automatically sent
to an external screenshot/preview service. Visiting a shop is still the user's
choice. Existing avatar and font providers are separate from gift-link previews.

## Features

- Personal wish lists with optional prices, notes and shop links.
- Family invitations and list sharing.
- Purchase claims and buyer-only cancellation, with buyer privacy preserved.
- Most Wanted and On Sale flags, filtering, and price sorting.
- Profile setup, purchase history, activity notifications, and visible save errors.
- Responsive layouts, Christmas countdown, snow and purchase celebrations.

This is a private family project and is not licensed for public use.
