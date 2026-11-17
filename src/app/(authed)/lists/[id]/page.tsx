"use client";

//React
import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { setListShared } from "@/lib/lists-api";

//Ui components
import CountdownBanner from "@/components/ui/countdown-banner";
import AddItemForm from "@/components/items/add-item-form";
import ItemRowCard from "@/components/items/item-row";
import ListScrollReveal from "@/components/lists/list-scroll-reveal";

//Utils
import type { ListRow, ItemRow as ItemRowType } from "@/types/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
	getListWithItems,
	getUserFamilyGroup,
	isListShared,
	updateListLastViewed,
	calculateNewPurchases,
	filterItems,
	sortItems,
} from "@/lib/list-helpers";
import {
	triggerNotificationConfetti,
} from "@/lib/confetti-helpers";

// API
import {
	addItem,
	updateItem,
	togglePurchased,
	deleteItem,
} from "@/lib/items-api";

export default function ListDetailPage() {
	const { id } = useParams<{ id: string }>();
	// A new list gets fresh state; requests from the previous list cannot own it.
	return <ListDetailContent key={id} id={id} />;
}

function ListDetailContent({ id }: { id: string }) {
	const router = useRouter();
	const mounted = useRef(false);
	const refreshVersion = useRef(0);
	const addPending = useRef(false);
	const sharePending = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => { mounted.current = false; };
	}, []);

	// state
	const [list, setList] = useState<ListRow | null>(null);
	const [items, setItems] = useState<ItemRowType[]>([]);
	const [loading, setLoading] = useState(true);
	const [revealComplete, setRevealComplete] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [now0] = useState(() => Date.now());
	const [userId, setUserId] = useState<string | null>(null);
	const [familyGroupId, setFamilyGroupId] = useState<string | null>(null);
	const [isShared, setIsShared] = useState(false);
	const [shareLoading, setShareLoading] = useState(false);
	const [newPurchaseCount, setNewPurchaseCount] = useState<number>(0);
	const [showPurchaseModal, setShowPurchaseModal] = useState(false);
	const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">(
		"default"
	);
	const [showMostWantedOnly, setShowMostWantedOnly] = useState(false);
	const [showOnSaleOnly, setShowOnSaleOnly] = useState(false);

	// form state
	const [adding, setAdding] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newPrice, setNewPrice] = useState("");
	const [newLink, setNewLink] = useState("");
	const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
	const [newNotes, setNewNotes] = useState("");
	const [formOpen, setFormOpen] = useState(false);

	useEffect(() => {
		let alive = true;

		(async () => {
			const user = await getCurrentUser();
			if (!alive) return;
			if (!user) {
				router.push("/login");
				return;
			}

			setUserId(user.id);

			// Fetch user's family group
			const familyGroupId = await getUserFamilyGroup(user.id);
			if (!alive) return;
			if (familyGroupId) {
				setFamilyGroupId(familyGroupId);
			}

			// Load list + items
			const {
				list: theList,
				items: theItems,
				listError,
				itemsError,
			} = await getListWithItems(id);

			if (!alive) return;

			if (listError || !theList) {
				setError(listError?.message ?? "List not found.");
				setLoading(false);
				return;
			}

			if (itemsError) setError(itemsError.message ?? null);

			setList(theList);
			setItems(theItems);

			// Compute new purchases since last_viewed_at (owner-only banner)
			const newPurchases = calculateNewPurchases(
				theItems,
				theList.last_viewed_at
			);
			setNewPurchaseCount(newPurchases);
			if (newPurchases > 0) {
				setShowPurchaseModal(true);
			}

			// Update last_viewed_at for the list when the owner views it (best-effort)
			await updateListLastViewed(id, user.id);
			if (!alive) return;

			// Check if this list is shared to the user's family group
			if (familyGroupId) {
				const shared = await isListShared(id, familyGroupId);
				if (!alive) return;
				setIsShared(shared);
			}

			setLoading(false);
		})();

		return () => {
			alive = false;
		};
	}, [id, router]);

	useEffect(() => {
		// subscribe to INSERT/UPDATE/DELETE for items in this list
		const channel = supabase
			.channel(`items:${id}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "items",
					filter: `list_id=eq.${id}`,
				},
				() => {
					refreshItems();
				}
			)
			.subscribe();

		return () => {
			// cleanup channel on route change/unmount
			supabase.removeChannel(channel);
		};
	}, [id]);

	async function refreshItems() {
		if (!mounted.current) return false;
		const version = ++refreshVersion.current;
		try {
			const { data, error } = await supabase
				.from("items")
				.select(
					"id,list_id,title,purchased,purchased_at,created_at,price_cents,link,image_url,notes,most_wanted,on_sale"
				)
				.eq("list_id", id)
				.order("created_at", { ascending: true });

			if (!mounted.current || version !== refreshVersion.current || error) return false;
			setItems(data ?? []);
			return true;
		} catch {
			return false;
		}
	}

	async function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		if (!mounted.current || !list || addPending.current) return;
		const title = newTitle.trim();
		if (!title) return;

		addPending.current = true;
		setAdding(true);
		setError(null);
		try {
			const inserted = await addItem(list.id, {
				title,
				price: newPrice,
				link: newLink, imageUrl: newImageUrl,
				notes: newNotes,
			});
			if (!mounted.current) return;
			++refreshVersion.current;
			setItems(prev => [...prev.filter(item => item.id !== inserted.id), inserted]);
			setNewTitle("");
			setNewPrice("");
			setNewLink(""); setNewImageUrl(null);
			setNewNotes("");
			setFormOpen(false);
		} catch (err: unknown) {
			if (mounted.current) setError(err instanceof Error ? err.message : "Could not confirm the gift was added. Check the list before trying again.");
		} finally {
			addPending.current = false;
			if (mounted.current) setAdding(false);
		}
	}

	async function handleToggle(idToToggle: string, nextPurchased: boolean) {
		if (!mounted.current) return false;
		// Invalidate refreshes started before this purchase.
		++refreshVersion.current;
		setError(null);
		try {
			const saved = await togglePurchased(idToToggle, nextPurchased);
			if (!mounted.current) return false;
			++refreshVersion.current;
			setItems((current) => current.map((item) =>
				item.id === idToToggle ? { ...item, ...saved } : item
			));

			return true;
		} catch (e: unknown) {
			if (!mounted.current) return false;
			const refreshed = await refreshItems();
			if (!mounted.current) return false;
			const message = typeof e === "object" && e !== null && "message" in e &&
				typeof e.message === "string" ? e.message : "Could not confirm the purchase change.";
			const rejected = typeof e === "object" && e !== null && "code" in e &&
				typeof e.code === "string" && /^[0-9A-Z]{5}$/.test(e.code);
			setError(rejected
				? message + (refreshed ? "" : " The list could not be refreshed. Refresh the page to see its current status.")
				: refreshed
					? "The save response was interrupted. The list has been refreshed—check this gift’s current status before trying again."
					: "We couldn’t confirm whether this purchase change saved, and the list could not be refreshed. Refresh the page before trying again.");
			return false;
		}
	}

	async function handleDelete(itemId: string): Promise<boolean> {
		if (!mounted.current) return false;
		setError(null);
		try {
			await deleteItem(itemId);
			if (!mounted.current) return false;
			++refreshVersion.current;
			setItems(current => current.filter(item => item.id !== itemId));
			return true;
		} catch {
			if (mounted.current) setError("We couldn’t confirm this gift was deleted. Refresh to check its current status before trying again.");
			return false;
		}
	}

	async function handleUpdate(itemId: string, patch: Partial<Pick<ItemRowType,
		"title" | "price_cents" | "link" | "notes" | "most_wanted" | "on_sale" | "image_url"
	>>): Promise<boolean> {
		if (!mounted.current) return false;
		setError(null);
		try {
			await updateItem(itemId, patch);
			if (!mounted.current) return false;
			++refreshVersion.current;
			setItems(current => current.map(item => item.id === itemId ? { ...item, ...patch } : item));
			return true;
		} catch {
			if (mounted.current) setError("We couldn’t confirm this gift was saved. Your edits are still here. Refresh to check its current status before trying again.");
			return false;
		}
	}

	async function handleShareToggle() {
		if (!mounted.current || !familyGroupId || !list || sharePending.current) return;
		sharePending.current = true;
		setShareLoading(true);
		setError(null);
		const nextShared = !isShared;
		try {
			await setListShared(list.id, familyGroupId, nextShared);
			if (!mounted.current) return;
			setIsShared(nextShared);
			toast.success(nextShared ? "List shared with family" : "List unshared from family");
		} catch {
			if (!mounted.current) return;
			const message = "We couldn’t confirm the sharing change. Refresh to check its current status before trying again.";
			setError(message);
			toast.error(message);
		} finally {
			sharePending.current = false;
			if (mounted.current) setShareLoading(false);
		}
	}

	const isOwner = userId && list && userId === (list as any).owner_user_id;

	const displayedItems = sortItems(filterItems(items, showOnSaleOnly, showMostWantedOnly), sortBy);
	const purchasedCount = items.filter(item => item.purchased).length;
	if (loading) return (
		<main className="ledger-theme list-scroll-loading" aria-busy="true">
			<div className="list-scroll-loading-paper ledger-paper">
				<div className="list-scroll-roller list-scroll-top" aria-hidden="true" />
				<p role="status" className="ledger-muted">Opening your list…</p>
				<div className="list-scroll-roller list-scroll-bottom" aria-hidden="true" />
			</div>
		</main>
	);
	if (!list) return <main className="ledger-theme ledger-paper ledger-page"><p role="alert" className="ledger-error">{error ?? "List not found."}</p></main>;

	return (
		<>
		<ListScrollReveal onComplete={() => setRevealComplete(true)}>
		<main className="ledger-theme ledger-paper ledger-page ledger-detail">
			<Link href={isOwner ? "/user-lists" : "/family-lists"} className="ledger-back-link">← {isOwner ? "My Lists" : "Family Lists"}</Link>
			<header className="ledger-page-heading">
				<div>
					<p className="ledger-eyebrow">The Christmas ledger</p>
					<h1 className="ledger-title">{list.title}</h1>
					<p className="ledger-muted">Created {new Date(list.created_at).toLocaleDateString()}</p>
					{isShared && <span className="ledger-badge">Shared with family</span>}
				</div>
				<CountdownBanner appearance="ledger" initialNow={now0} />
			</header>
			<div className="ledger-rule" aria-hidden="true">✦</div>
			<div className="ledger-detail-toolbar">
				<p className="ledger-muted">{purchasedCount} of {items.length} gifts purchased</p>
				<div className="ledger-inline-actions">
					{isOwner && familyGroupId && <button onClick={handleShareToggle} disabled={shareLoading} className="ledger-secondary">{shareLoading ? "Saving…" : isShared ? "Unshare from Family" : "Share to Family"}</button>}
					{isOwner && !formOpen && <button type="button" onClick={() => setFormOpen(true)} aria-expanded={formOpen} aria-controls="add-item-form" className="ledger-button">Add item</button>}
				</div>
			</div>
			{isOwner && formOpen && <AddItemForm open={formOpen} onOpenChange={setFormOpen}
				title={newTitle} setTitle={setNewTitle} price={newPrice} setPrice={setNewPrice}
				imageUrl={newImageUrl} setImageUrl={setNewImageUrl} link={newLink} setLink={setNewLink} notes={newNotes} setNotes={setNewNotes} onSubmit={handleAdd} submitting={adding} />}
			{error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
			{items.length > 0 && <div className="ledger-filters">
				<div className="ledger-inline-actions">
					<button type="button" className="ledger-filter" aria-pressed={showOnSaleOnly} onClick={() => setShowOnSaleOnly(!showOnSaleOnly)}>On Sale Only</button>
					<button type="button" className="ledger-filter" aria-pressed={showMostWantedOnly} onClick={() => setShowMostWantedOnly(!showMostWantedOnly)}>Most Wanted Only</button>
				</div>
				<label className="ledger-sort-label">Sort gifts<select value={sortBy} className="ledger-select" onChange={event => setSortBy(event.target.value as "default" | "price-asc" | "price-desc")}>
					<option value="default">Default order</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option>
				</select></label>
			</div>}
			<ul className="ledger-gift-list">
				{displayedItems.map(item => <ItemRowCard key={item.id} item={item} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} isOwner={Boolean(isOwner)} />)}
			</ul>
			{displayedItems.length === 0 && <div className="ledger-empty"><h2>{items.length ? "No gifts match these filters" : "A little room for wishes"}</h2><p>{items.length ? "Try turning off a filter to see more gifts." : isOwner ? "Add your first gift to get started." : "No gifts have been added to this list yet."}</p></div>}
		</main>
		</ListScrollReveal>
				{/* Purchase Notification Modal */}
				{isOwner && revealComplete && showPurchaseModal && newPurchaseCount > 0 && (
					<>
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
							onClick={() => setShowPurchaseModal(false)}
						/>
						{/* Modal */}
						<motion.div
							initial={{ opacity: 0, scale: 0.8, y: 20 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.8, y: 20 }}
							transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
							className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
							onAnimationComplete={() => {
								// Trigger confetti after modal appears
								triggerNotificationConfetti();
								// Auto-dismiss after 3 seconds
								setTimeout(() => {
									setShowPurchaseModal(false);
								}, 3000);
							}}
						>
							<div className="ledger-theme ledger-paper ledger-dialog mx-4">
								<div className="text-center space-y-4">
									<div className="text-6xl">🎁</div>
									<h2 className="ledger-notification-title">Good News!</h2>
									<p className="ledger-muted">
										<span className="font-bold text-2xl">
											{newPurchaseCount}
										</span>{" "}
										gift{newPurchaseCount > 1 ? "s were" : " was"} purchased
										<br />
										since your last visit!
									</p>
								</div>
							</div>
						</motion.div>
					</>
				)}

		</>
	);
}
