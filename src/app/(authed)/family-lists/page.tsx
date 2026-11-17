"use client";
import { useState } from "react";
import { getListsWithProgress } from "@/lib/list-progress";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { RefreshNotice } from "@/components/ui/refresh-notice";
import FamilyScroll from "@/components/lists/family-scroll";
import CountdownBanner from "@/components/ui/countdown-banner";
const loadLists = () => getListsWithProgress(true);
export default function FamilyListsPage() {
 const [initialNow] = useState(() => Date.now());
 const { data, error, loading, retry } = useRefreshingData(loadLists, "family-lists-progress");
 const lists = data ?? [];
 return <main className="ledger-theme ledger-paper ledger-page ledger-family-page">
  <header className="ledger-page-heading"><div><p className="ledger-eyebrow">Shared Christmas wishes</p><h1 className="ledger-title">Family Lists</h1><p>Find a gift, claim it, and keep the surprise secret.</p></div><CountdownBanner initialNow={initialNow} appearance="ledger" /></header>
  {error && <RefreshNotice message={error} onRetry={retry} />}
  {loading ? <p role="status" className="ledger-empty">Loading family lists…</p> : error && data === null ? null : lists.length === 0 ? <p className="ledger-empty">You don&apos;t have any shared lists yet. Once friends or family share lists with you, they&apos;ll appear here.</p> :
   <section className="family-scroll-grid" aria-label="Family wish lists">{lists.map(list => <FamilyScroll key={list.id} list={list} />)}</section>}
 </main>;
}
