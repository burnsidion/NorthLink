"use client";
import { useState } from "react";
import { getListsWithProgress } from "@/lib/list-progress";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { RefreshNotice } from "@/components/ui/refresh-notice";
import ListCard from "@/components/lists/list-card";
import CountdownBanner from "@/components/ui/countdown-banner";
const loadLists = () => getListsWithProgress(true);
export default function FamilyListsPage() {
 const [initialNow] = useState(() => Date.now());
 const { data, error, loading, retry } = useRefreshingData(loadLists, "family-lists-progress");
 const lists = data ?? [];
 return <main className="ledger-theme ledger-paper ledger-page">
  <header className="ledger-page-heading"><div><p className="ledger-eyebrow">Shared Christmas wishes</p><h1 className="ledger-title">Family Lists</h1><p>Find a gift, claim it, and keep the surprise secret.</p></div><CountdownBanner initialNow={initialNow} appearance="ledger" /></header>
  {error && <RefreshNotice message={error} onRetry={retry} />}
  {loading ? <p role="status" className="ledger-empty">Loading family lists…</p> : error && data === null ? null : lists.length === 0 ? <p className="ledger-empty">You don&apos;t have any shared lists yet. Once friends or family share lists with you, they&apos;ll appear here.</p> :
   <section className="ledger-scroll-stack" aria-label="Family wish lists">{lists.map(list => <ListCard key={list.id} list={list} hideManageButton showOwner />)}</section>}
 </main>;
}
