export const quickTourSteps = [
 { title: "Create or join a family group", section: "Home → Family Group", text: "From Home, open Family Group to create a group or join one with an invite code. Share your group’s code to invite other people." },
 { title: "Create and share a list", section: "My Lists", text: "Open My Lists and select Create list. You can make a list for yourself or someone else. Open the list and use Share to Family to let your group view it." },
 { title: "Add items to your list", section: "Your list → Add item", text: "Paste a product link and choose Fill from link to suggest a name, price and thumbnail. Some shops won’t provide details; you can always enter them manually. Add sizes, colors and preferences in Notes, then save." },
 { title: "Browse family lists", section: "Family Lists", text: "Open Family Lists, then select a list to view its items. Select View on an item to open its product page. Complete the purchase on the retailer’s site." },
 { title: "Mark items as purchased", section: "Gift checkbox → Purchased Gifts", text: "After buying an item, select its checkbox on the list to mark it purchased. The list owner can see the purchased status, but not who bought it. Review items you marked in Purchased Gifts. Only the buyer can undo that status." },
] as const;

const dismissed = new Set<string>();
const key = (userId: string) => `cybersanta:quick-tour:v1:${userId}`;
export function tourWasDismissed(userId: string): boolean {
 if (dismissed.has(userId)) return true;
 try { return window.localStorage.getItem(key(userId)) === "dismissed"; } catch { return false; }
}
export function dismissTour(userId: string): void {
 dismissed.add(userId);
 try { window.localStorage.setItem(key(userId), "dismissed"); } catch { /* Still remember for this page session when storage is unavailable. */ }
}
