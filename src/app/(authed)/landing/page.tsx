"use client";
//Deps
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getCurrentSession } from "@/lib/auth-helpers";
import { calculateNewPurchases } from "@/lib/list-helpers";

import CountdownBanner from "@/components/ui/countdown-banner";
import FamilyGroupPanel from "@/components/family/family-group-panel";
import Link from "next/link";

export default function ListsPage() {
	const sb = supabase;
	const router = useRouter();
	const [initialNow] = useState(() => Date.now());
	const [displayName, setDisplayName] = useState<string | null>(null);
	const [activityCount, setActivityCount] = useState<number>(0);
	const [listsWithActivity, setListsWithActivity] = useState<
		Array<{ id: string; title: string }>
	>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			const session = await getCurrentSession();
			if (!session) {
				router.replace("/login");
				return;
			}

			const { data: prof, error } = await sb
				.from("profiles")
				.select("display_name")
				.eq("id", session.user.id)
				.maybeSingle();

			if (!error) {
				setDisplayName(prof?.display_name ?? null);
			} else {
				console.error("fetch profile failed:", error);
			}

			try {
				const { data: ownedLists, error: listsErr } = await sb
					.from("lists")
					.select("id,title,last_viewed_at,items(id,purchased,purchased_at)")
					.eq("owner_user_id", session.user.id);
				if (listsErr) {
					console.error(
						"Error fetching owned lists for activity tab:",
						listsErr
					);
				} else if (Array.isArray(ownedLists)) {
					const activeLists = ownedLists
						.filter((lst) => {
							if (!lst.last_viewed_at || !Array.isArray(lst.items))
								return false;
							// Use helper to check if there are new purchases
							return calculateNewPurchases(lst.items, lst.last_viewed_at) > 0;
						})
						.map((lst) => ({ id: lst.id, title: lst.title }));
					setActivityCount(activeLists.length);
					setListsWithActivity(activeLists);
				}
			} catch (e) {
				console.error("Error computing activity tab:", e);
			}
			setTimeout(() => setLoading(false), 700);
		})();
	}, [router, sb]);

 return <main className="ledger-theme ledger-paper ledger-page">
  <header className="ledger-page-heading"><div><p className="ledger-eyebrow">The Christmas ledger</p><h1 className="ledger-title">Welcome, {displayName ?? "shopper"}!</h1><p>Christmas wishes, thoughtful gifts, and well-kept secrets.</p></div><CountdownBanner initialNow={initialNow} appearance="ledger" /></header>
  <Link href="/onboarding" className="ledger-secondary">Edit profile</Link>
  <div className="ledger-home-family"><FamilyGroupPanel /></div>
  {activityCount > 0 && <aside className="ledger-notice" aria-label="New gift activity">You have activity on {listsWithActivity.map((list, idx) => <span key={list.id}><Link href={`/lists/${list.id}`}>{list.title}</Link>{idx < listsWithActivity.length - 1 ? ", " : ""}</span>)} since your last visit.</aside>}
  {loading ? <p role="status" className="ledger-empty">Opening your ledger…</p> : <section className="ledger-home-grid" aria-label="Your Christmas plans">
   {[{title:"My Lists",text:"Gather your wishes in one place.",href:"/user-lists",action:"View My Lists"},{title:"Family Lists",text:"Find something they will love.",href:"/family-lists",action:"View Family Lists"},{title:"Purchased Gifts",text:"Keep track of the gifts you have claimed.",href:"/purchased-items",action:"View My Purchases"}].map(card => <article key={card.href} className="ledger-home-card"><p className="ledger-eyebrow">CyberSanta</p><h2>{card.title}</h2><p>{card.text}</p><Link href={card.href} className="ledger-button">{card.action}</Link></article>)}
  </section>}
  <section className="ledger-how"><h2>How it works</h2><p>Create your wish list, share it with your family, and mark gifts as purchased on their lists. They can see that a gift is claimed, while the buyer stays a secret.</p></section>
 </main>;
}
