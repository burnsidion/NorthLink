# OWL-81: Purchase notifications

Dashboard purchase updates use the existing parchment dialog styling. They show unread purchase counts grouped by owned list, with links to review each list. Buyer identities and gift names are omitted. Purchases made by the list owner are excluded.

The quick tour takes priority. Closing the notification keeps it quiet during the current page visit without acknowledging purchases; the dashboard banner can reopen it. Opening an affected list acknowledges only the purchases in its successfully loaded snapshot. Failed reads and visits by other users do not acknowledge activity. First visits with no previous acknowledgement are supported.

The previous list-page notification was removed to avoid duplicate dialogs. Purchase saving and timed buyer reveal remain unchanged. No database migration or hosted changes are needed.

Validation:
- `npm run check`: 160 tests passed, including notification aggregation, self-purchase exclusion, failed reads, owner-only acknowledgement, tour coordination, dismissal/replay, and snapshot watermarks.
- `npm run build`: passed.
- Targeted ESLint and `git diff --check`: passed.
- Browser preview of the real dialog and tour: desktop and 390px/320px mobile layouts, keyboard focus wrapping, Escape, replay, scroll restoration, and tour priority checked. Preview used sample data; a real two-account purchase/login flow remains a useful final manual check.

Temporary preview route was removed. Nothing committed or pushed.
