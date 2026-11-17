# OWL-74 — checkpoint 1

Implemented the optional dashboard tour. No database changes or new dependencies.

- First visit to the loaded signed-in dashboard offers Take a quick tour or Skip for now.
- Five steps explain family groups, creating/sharing lists, adding gifts and manual autofill fallback, shopping from Family Lists, and purchase status/buyer privacy.
- Back, Next, Finish and Skip; Escape dismisses. Keyboard focus uses the existing dialog focus helper and body scrolling is locked while open.
- Quick tour beside Edit profile reopens the introduction. Replay does not navigate, create records or perform purchases.
- Dismissal/finish is stored by account and tour version in browser localStorage, with an in-memory fallback when storage is blocked. A new device/browser or cleared storage can offer the introduction again. Existing accounts are offered it too on their first dashboard visit after release.

Validation: 132 unit tests passed, TypeScript passed, targeted ESLint passed, production build passed, git diff whitespace check passed. New tests cover dismissal and separate accounts, Back/Next/Finish/replay, Escape and scroll cleanup, unavailable storage. Focus behavior reuses the existing helper; new browser keyboard and phone layout checks remain for checkpoint 2.

Checkpoint 2 pending approval: illustrated preview styling, festive finishing touches, desktop/mobile and keyboard visual checks. No commits, pushes, PR or Linear edits performed.
