"use client";
import { useState } from "react";
import { getMyPurchases } from "@/lib/purchases-api";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { RefreshNotice } from "@/components/ui/refresh-notice";
import CountdownBanner from "@/components/ui/countdown-banner";
import { safeWebUrl, usd } from "@/lib/format";
export default function PurchasedItemsPage() {
 const [initialNow] = useState(() => Date.now());
 const { data, error, loading, retry } = useRefreshingData(getMyPurchases, "my-purchases-progress");
 const items = data ?? [];
 return <main className="ledger-theme ledger-paper ledger-page">
  <header className="ledger-page-heading"><div><p className="ledger-eyebrow">Your gift register</p><h1 className="ledger-title">Purchased Gifts</h1><p>A little help keeping track of the surprises.</p></div><CountdownBanner initialNow={initialNow} appearance="ledger" /></header>
  {error && <RefreshNotice message={error} onRetry={retry} />}
  {loading ? <p role="status" className="ledger-empty">Loading purchased gifts…</p> : error && data === null ? null : items.length === 0 ? <div className="ledger-empty"><p>You have not purchased any gifts yet.</p><p>When you mark items as purchased on family lists, they will appear here.</p></div> :
   <section aria-label="Purchased gifts">{items.map(item => {
    const giftLink = safeWebUrl(item.link);
    return <article key={item.id} className="ledger-purchased-row">
     <div className="ledger-gift-heading"><h2>{item.title}</h2>{typeof item.price_cents === "number" && <strong>{usd.format(item.price_cents / 100)}</strong>}</div>
     <p>From: {item.list_owner_name} · List: {item.list_title}</p>
     {item.notes && <p className="ledger-gift-notes">{item.notes}</p>}
     {giftLink && <a href={giftLink} target="_blank" rel="noopener noreferrer" className="ledger-secondary">View Item</a>}
    </article>;
   })}</section>}
 </main>;
}
