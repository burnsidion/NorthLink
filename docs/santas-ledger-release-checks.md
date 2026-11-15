# Santa’s Ledger release checks

Checked locally on November 15, 2026. This records the redesign checks; it is not confirmation of a production deployment.

## Verified

- Type checking and all 89 JavaScript regression tests pass, including dialog focus containment and restoration, authentication, refresh failures and purchase behavior.
- The isolated Docker privacy suite passes. It covers access restrictions, buyer privacy and competing purchases without connecting to CyberSanta.
- Desktop (1440px) and narrow-phone (320px) display checks pass with disposable sample data: long names, unbroken titles, empty/loading/error states, scroll cards and list dialogs fit without horizontal overflow.
- Create/manage dialogs focus their first control, wrap Tab and Shift+Tab, close with Escape when idle and return focus to their trigger. Mobile menu Escape also returns focus to its toggle.
- The decorative layer is fixed to the viewport and ignores pointer input. Parchment surfaces cover the snow, keeping it out of the reading area.
- Key color pairs were checked numerically: main ink/paper 11.66:1, muted ink/paper 5.74:1, primary button text/background 10.97:1, input border/input surface 4.18:1. These checks are not a complete accessibility audit.
- Changed files introduce no new lint errors or warnings. Full-project lint still has 33 existing errors and 15 warnings; the two existing errors in the create-list component are unchanged.
- Reduced-motion rules disable the snow and scroll transitions. Motion components inherit the user’s preference. An actual OS preference toggle was not exercised in the browser session.

## Still pending before release sign-off

Use two separate signed-in browser sessions and disposable lists/gifts. No real family records were changed during the checks above.

1. As the owner, create a test list and gift, share it, then rename/edit it. Refresh to confirm the saved changes.
2. As a family shopper, open the shared list and claim the gift. Refresh both sessions: both should see purchased status, while the owner must not see the buyer’s identity. The gift should appear in the buyer’s Purchased Gifts screen.
3. Confirm the owner cannot cancel the shopper’s purchase. The buyer can cancel it; refresh both sessions to confirm the result.
4. Unshare the list and verify the shopper loses access, including through its direct URL. An unrelated account should also be denied access to private lists. Clean up only the disposable records afterward.

The browser layout previews used real components with sample data, not a complete signed-in owner/shopper walkthrough. Temporary preview routes were removed. No database migration or hosted setting change is needed for this redesign.
