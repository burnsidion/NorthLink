# Festive loading and purchase feedback — checkpoint 1

- Added reusable decorative WreathSpinner and labeled WreathLoader components.
- Purchase checkbox now displays an inline wreath only while its save promise is pending. Removed its full-screen multi-step loader and obsolete enabling prop.
- Saves start immediately; duplicate submissions remain blocked. Successful purchases reveal a short CSS checkmark pop and the previously approved red/green/white confetti. No artificial minimum loading time or animation wait.
- Existing checked gifts do not pop on page arrival; unpurchasing does not celebrate. Pending status has a screen-reader announcement and button busy/pressed semantics.
- Reduced-motion CSS disables wreath spinning, checkmark motion and pressed scaling; confetti is suppressed when the reduced-motion preference is enabled.
- Public page loaders/transitions and removal of the dashboard delay are deferred to checkpoint 2.

Validation: 134 unit tests and typecheck passed; targeted lint, production build and whitespace checks passed. Browser preview of actual components verified pending/disabled checkbox, confirmed checked state, failed-save error and retry-enabled unchecked state. The preview used local simulated responses, did not mutate family data, and was removed afterward. The user's existing development server was left running.

Screenshot: `/Users/cthulhusrealm/.codex/visualizations/2026/11/12/01a1cdf1-9d86-7ec2-84d8-2ed2860532ba/wreath-purchase-pending.jpg`

No database or hosted changes. No commits, pushes, PR or Linear edits. Existing uncommitted tour and confetti changes preserved.
