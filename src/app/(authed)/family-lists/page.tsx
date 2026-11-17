"use client";
import { useState } from "react";
import { getProfileUser } from "@/lib/auth-helpers";
import { getUserGroupNames } from "@/lib/family-group-helpers";
import { getListsWithProgress } from "@/lib/list-progress";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { RefreshNotice } from "@/components/ui/refresh-notice";
import FamilyScroll from "@/components/lists/family-scroll";
import CountdownBanner from "@/components/ui/countdown-banner";
const loadLists = async () => {
 const user = await getProfileUser();
 if (!user) throw new Error("Please sign in again to refresh your lists.");
 const [lists, groupNames] = await Promise.all([getListsWithProgress(true), getUserGroupNames(user.id)]);
 return { lists, groupNames };
};
export default function FamilyListsPage() {
 const [initialNow] = useState(() => Date.now());
 const { data, error, loading, retry } = useRefreshingData(loadLists, "family-lists-progress");
 const lists = data?.lists ?? [];
 const groupNames = data?.groupNames ?? [];
 return <main className="ledger-theme ledger-paper ledger-page ledger-family-page">
  <header className="ledger-page-heading ledger-family-heading"><div><h1 className="ledger-title ledger-family-title"><span>Family Lists</span></h1>{groupNames.length > 0 && <p className="font-semibold">{groupNames.length === 1 ? groupNames[0] : "Shared across your family groups"}</p>}<p>Browse shared lists and wanted gifts.</p></div><CountdownBanner initialNow={initialNow} appearance="ledger" /></header>
  {error && <RefreshNotice message={error} onRetry={retry} />}
  {loading ? <p role="status" className="ledger-empty">Loading family lists…</p> : error && data === null ? null : lists.length === 0 ? <p className="ledger-empty">You don&apos;t have any shared lists yet. Once friends or family share lists with you, they&apos;ll appear here.</p> :
   <section className="family-scroll-grid" aria-label="Family wish lists">{lists.map(list => <FamilyScroll key={list.id} list={list} />)}</section>}
 </main>;
}
