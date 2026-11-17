# Festive loading and page transitions — checkpoint 2 (final)

- Connected the shared wreath to dashboard data loading, My Lists, Family Lists, Purchased Gifts, individual list loading, profile checks/redirect waits and profile setup loading.
- Added the authenticated App Router loading boundary for pending navigation.
- Kept My Lists placeholder cards and the individual list’s existing scroll loading/unroll behavior. The scroll page does not receive a second page-arrival effect.
- Added 180ms opacity arrival on the dashboard/list-index/purchases pages; loaded content sections use a 4px upward fade. CSS effects run on mount, with no remount keys, exit delays, minimum waits or resetting loading on background refresh.
- Removed the dashboard’s existing fixed 700ms loading delay. No changes to auth decisions or data permissions.
- Reduced-motion CSS disables the new arrival effects and wreath rotation. Status text remains readable and decorative wreath SVGs are hidden from assistive technology.

Validation:
- Full unit suite: 136 passing, including auth/profile redirect protections, purchase confirmation behavior, retained content after failed background refresh, tour behavior and new loader accessibility contracts.
- Typecheck and production build passed; targeted lint passed on page loader/auth/profile components and list-index/dashboard screens. The individual list page retains its previously documented unrelated lint findings; only its import and loading markup changed.
- Signed-in browser: observed Checking your profile and the Loading page boundary during navigation; verified My Lists, Family Lists, Purchased Gifts and Home reach their screens.
- Opened/dismissed Quick tour from the dashboard; backdrop still covers the full viewport (2560×1440).
- Opened the existing list; scroll completed with data-open=true and its original ledger-detail class, without the new arrival class.
- Isolated actual-component loading preview at 390×844: wreath labels and list placeholders remained readable with no horizontal overflow. Screenshot saved below. The temporary preview route and generated references were removed before the final build.
- Browser media preference was not changed; reduced-motion behavior is covered by the explicit CSS rules and purchase preference unit test.

Screenshot: `/Users/cthulhusrealm/.codex/visualizations/2026/11/12/01a1cdf1-9d86-7ec2-84d8-2ed2860532ba/page-loading-mobile.jpg`

No commits, pushes, PR/Linear edits or database changes. Prior uncommitted tour and confetti work preserved. User’s existing development server left running.
