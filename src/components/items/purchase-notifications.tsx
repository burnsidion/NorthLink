"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPurchaseActivity, type PurchaseActivity } from "@/lib/purchase-activity";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

export function PurchaseNotificationDialog({ open, lists, onClose }: {
 open: boolean; lists: PurchaseActivity[]; onClose: () => void;
}) {
 const dialog = useRef<HTMLDivElement>(null);
 useDialogFocus(open,dialog);
 useEffect(() => {
  if (!open) return;
  const previous = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = previous; };
 },[open]);
 if (!open || !lists.length) return null;
 const total = lists.reduce((sum,list) => sum+list.count,0);
 return <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="purchase-notification-title"
  aria-describedby="purchase-notification-description" className="ledger-theme ledger-dialog-backdrop ledger-tour-backdrop"
  onKeyDown={event => {if(event.key === "Escape"){event.stopPropagation();onClose();}}}
  onClick={event => {if(event.target === event.currentTarget)onClose();}}>
  <div className="ledger-paper ledger-dialog ledger-purchase-notification">
   <p className="ledger-eyebrow">Purchase update</p>
   <h2 id="purchase-notification-title">{total} {total === 1 ? "gift was" : "gifts were"} purchased</h2>
   <p id="purchase-notification-description">Across {lists.length === 1 ? "one of your lists" : `${lists.length} of your lists`}. Open a list to review its purchased gifts.</p>
   <ul className="ledger-purchase-notification-lists">{lists.map(list => <li key={list.id}><Link href={`/lists/${list.id}`} onClick={onClose}><strong>{list.title}</strong><span>{list.count} {list.count === 1 ? "gift" : "gifts"} purchased <span aria-hidden="true">→</span></span></Link></li>)}</ul>
   <div className="ledger-inline-actions"><button type="button" className="ledger-button" onClick={onClose}>Close</button></div>
  </div>
 </div>;
}

// Keep a closed popup quiet across SPA navigation; a fresh login reload resets this.
const dismissedForVisit = new Set<string>();

export default function PurchaseNotifications({ userId, tourOpen }: {userId:string; tourOpen:boolean}) {
 const load = useCallback(() => getPurchaseActivity(userId),[userId]);
 const {data,error,loading,retry} = useRefreshingData(load,`purchase-activity:${userId}`);
 const [dismissed,setDismissed] = useState(() => dismissedForVisit.has(userId));
 const review = useRef<HTMLButtonElement>(null);
 useEffect(() => { if (dismissed) review.current?.focus(); },[dismissed]);
 const lists = error ? [] : data ?? [];
 const total = lists.reduce((sum,list) => sum+list.count,0);
 return <>
  {error && <aside className="ledger-notice" role="alert"><p>Couldn’t check purchase notifications. Your lists are still available.</p><button type="button" onClick={retry} className="ledger-text-button">Retry notifications</button></aside>}
  {total > 0 && <aside className="ledger-notice" aria-label="New gift activity"><p>{total} {total === 1 ? "gift was" : "gifts were"} purchased across {lists.length} of your lists.</p><button ref={review} type="button" onClick={() => setDismissed(false)} className="ledger-text-button">View purchase update</button></aside>}
  <PurchaseNotificationDialog open={!loading && !tourOpen && !dismissed && total>0} lists={lists} onClose={() => { dismissedForVisit.add(userId); setDismissed(true); }} />
 </>;
}
