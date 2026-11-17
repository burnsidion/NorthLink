"use client";

export default function BuyerRevealNotice({ hasPurchases, revealedCount, nextRevealAt, loading, error, onRetry }: {
 hasPurchases: boolean; revealedCount: number; nextRevealAt: string | null;
 loading: boolean; error: boolean; onRetry: () => void;
}) {
 if (!hasPurchases) return null;
 if (error) return <aside className="ledger-buyer-notice ledger-buyer-notice-error" role="alert">
  <p>Buyer details couldn’t be loaded. Your gift list is still available.</p>
  <button type="button" className="ledger-secondary" disabled={loading} onClick={onRetry}>{loading ? "Checking…" : "Retry buyer details"}</button>
 </aside>;
 if (!revealedCount && !nextRevealAt) return loading ? <p className="ledger-muted" role="status">Checking buyer details…</p> : null;
 const date = nextRevealAt ? new Intl.DateTimeFormat("en-US", { timeZone:"America/New_York", month:"long", day:"numeric", year:"numeric" }).format(new Date(nextRevealAt)) : null;
 return <aside className="ledger-buyer-notice" aria-label="Buyer information">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M4 9h16v4H4zM6 13v8h12v-8M12 9v12M12 9C4 9 6 2 9 4c2 1 3 5 3 5Zm0 0c8 0 6-7 3-5-2 1-3 5-3 5Z" /></svg>
  <div>{revealedCount > 0 ? <><h2>Buyer details are available</h2><p>{revealedCount} purchased {revealedCount === 1 ? "gift shows" : "gifts show"} the buyer’s name below.{date && <> Other buyers remain private until {date} at midnight Eastern time.</>}</p></>
   : <><h2>Buyer names stay private until after Christmas</h2><p>Names become available on {date} at midnight Eastern time.</p></>}</div>
 </aside>;
}
