"use client";

//React
import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { links } from "@/config/nav-links";
import { Snowflake } from "lucide-react";
import { Button as StatefulButton } from "@/components/ui/stateful-button";
import { Confetti, type ConfettiRef } from "@/components/ui/confetti";
import confetti from "canvas-confetti";

//Ui components
import { FestiveGlow } from "@/components/ui/festive-glow";
import Snowfall from "@/components/ui/snowfall";
import { StarsBackground } from "@/components/ui/stars-background";
import CountdownBanner from "@/components/ui/countdown-banner";
import AddItemForm from "@/components/items/add-item-form";
import ItemRowCard from "@/components/items/item-row";
import PageFade from "@/components/ui/page-fade";
import { SkeletonCard } from "@/components/ui/skeleton-card";

//Utils
import { toCents, normalizeUrl, usd } from "@/lib/format";
import type { ListRow, ItemRow as ItemRowType } from "@/types/db";

// API
import {
	addItem,
	updateItem,
	togglePurchased,
	deleteItem,
} from "@/lib/items-api";

export default function ListDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();

	// state
	const [list, setList] = useState<ListRow | null>(null);
	const [items, setItems] = useState<ItemRowType[]>([]);
	const [loading, setLoading] = useState(true);
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
	const [newNotes, setNewNotes] = useState("");
	const [formOpen, setFormOpen] = useState(false);

	useEffect(() => {
		let alive = true;

		(async () => {
			const {
				data: { user },
				error: userErr,
			} = await supabase.auth.getUser();
			if (userErr || !user) {
				router.push("/login");
				return;
			}

			setUserId(user.id);

			// Fetch user's family group
			const { data: familyGroup } = await supabase
				.from("group_members")
				.select("group_id")
				.eq("user_id", user.id)
				.maybeSingle();

			if (familyGroup?.group_id) {
				setFamilyGroupId(familyGroup.group_id);
			}

			// Load list + items (including last_viewed_at and purchased_at)
			const [
				{ data: theList, error: listErr },
				{ data: theItems, error: itemsErr },
			] = await Promise.all([
				supabase
					.from("lists")
					.select("id,title,created_at,owner_user_id,last_viewed_at")
					.eq("id", id)
					.single(),
				supabase
					.from("items")
					.select(
						"id,list_id,title,purchased,purchased_at,created_at,price_cents,link,notes,most_wanted,on_sale"
					)
					.eq("list_id", id)
					.order("created_at", { ascending: true }),
			]);

			if (!alive) return;
			if (listErr || !theList) {
				setError(listErr?.message ?? "List not found.");
				setLoading(false);
				return;
			}

			if (itemsErr) setError(itemsErr.message ?? null);

			setList(theList);
			setItems(theItems ?? []);

			// Compute new purchases since last_viewed_at (owner-only banner)
			try {
				if (theList.last_viewed_at && Array.isArray(theItems)) {
					const count = (theItems ?? []).filter(
						(it: any) =>
							it.purchased === true &&
							it.purchased_at &&
							new Date(it.purchased_at) >
								new Date(theList.last_viewed_at as string)
					).length;
					setNewPurchaseCount(count);
					if (count > 0) {
						setShowPurchaseModal(true);
					}
				} else {
					setNewPurchaseCount(0);
				}
			} catch (e) {
				console.warn("Error computing newPurchaseCount:", e);
				setNewPurchaseCount(0);
			} // Update last_viewed_at for the list when the owner views it (best-effort)
			try {
				const { error: lastViewedError } = await supabase
					.from("lists")
					.update({ last_viewed_at: new Date().toISOString() })
					.eq("id", id)
					.eq("owner_user_id", user.id);

				if (lastViewedError) {
					console.warn(
						"Failed to update last_viewed_at:",
						lastViewedError.message
					);
				}
			} catch (e) {
				console.warn("Error updating last_viewed_at:", e);
			}

			// Check if this list is shared to the user's family group
			if (familyGroup?.group_id) {
				const { data: shareRow } = await supabase
					.from("list_shares")
					.select("*")
					.eq("list_id", id)
					.eq("group_id", familyGroup.group_id)
					.maybeSingle();

				setIsShared(!!shareRow);
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
		const { data, error } = await supabase
			.from("items")
			.select(
				"id,list_id,title,purchased,created_at,price_cents,link,notes,most_wanted,on_sale"
			)
			.eq("list_id", id)
			.order("created_at", { ascending: true });

		if (!error) setItems(data ?? []);
	}

	async function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		if (!list) return;
		const title = newTitle.trim();
		if (!title) return;

		setAdding(true);
		setError(null);
		try {
			const inserted = await addItem(list.id, {
				title,
				price: newPrice,
				link: newLink,
				notes: newNotes,
			});
			setItems((prev) => [...prev, inserted]);
			setNewTitle("");
			setNewPrice("");
			setNewLink("");
			setNewNotes("");
			setFormOpen(false);
		} catch (err: any) {
			setError(err?.message ?? String(err));
		} finally {
			setAdding(false);
		}
	}

	async function handleToggle(idToToggle: string, nextPurchased: boolean) {
		const prev = items;
		setItems((p) =>
			p.map((it) =>
				it.id === idToToggle ? { ...it, purchased: nextPurchased } : it
			)
		);
		try {
			await togglePurchased(idToToggle, nextPurchased);

			// Trigger confetti when marking an item as purchased
			if (nextPurchased) {
				confetti({
					particleCount: 100,
					spread: 70,
					origin: { y: 0.6 },
					colors: [
						"#26ccff",
						"#a25afd",
						"#ff5e7e",
						"#88ff5a",
						"#fcff42",
						"#ffa62d",
					],
				});
			}
		} catch (e: any) {
			setItems(prev); // revert
			setError(e?.message ?? String(e));
		}
	}

	async function handleDelete(idToDelete: string) {
		const prev = items;
		setItems((p) => p.filter((it) => it.id !== idToDelete));
		try {
			await deleteItem(idToDelete);
		} catch (e: any) {
			setItems(prev); // revert
			setError(e?.message ?? String(e));
		} finally {
			await refreshItems();
		}
	}

	async function handleUpdate(
		itemId: string,
		patch: Partial<
			Pick<ItemRowType, "title" | "price_cents" | "link" | "notes">
		>
	) {
		const prev = items;
		setItems((p) =>
			p.map((it) => (it.id === itemId ? { ...it, ...patch } : it))
		);
		try {
			await updateItem(itemId, patch);
		} catch (e: any) {
			setItems(prev); // revert
			setError(e?.message ?? String(e));
		} finally {
			await refreshItems();
		}
	}

	async function handleShareToggle() {
		if (!familyGroupId || !list) return;

		setShareLoading(true);
		setError(null);

		try {
			if (isShared) {
				// Unshare
				const { error } = await supabase
					.from("list_shares")
					.delete()
					.match({ list_id: list.id, group_id: familyGroupId });

				if (error) throw error;
				setIsShared(false);
			} else {
				// Share
				const { error } = await supabase
					.from("list_shares")
					.insert({ list_id: list.id, group_id: familyGroupId });

				if (error) throw error;
				setIsShared(true);
			}
		} catch (err: any) {
			setError(err?.message ?? String(err));
		} finally {
			setShareLoading(false);
		}
	}

	const isOwner = userId && list && userId === (list as any).owner_user_id;

	if (loading)
		return (
			<main className="relative min-h-screen px-6 py-8 space-y-6 overflow-hidden">
				<PageFade>
					<StarsBackground />
					<Snowfall
						count={70}
						speed={40}
						wind={0.18}
						enableMeteors={true}
						meteorCount={3}
					/>
					<CountdownBanner initialNow={Date.now()} />
					{/* header skeleton */}
					<header className="mx-auto w-full max-w-5xl">
						<div className="text-center space-y-3">
							<div className="mx-auto h-8 w-40 rounded bg-white/10 animate-pulse" />
							<div className="mx-auto h-10 w-48 rounded-full bg-white/10 animate-pulse" />
						</div>
					</header>
					{/* cards grid skeleton */}
					<section
						className="grid grid-cols-1 sm:grid-cols-2 gap-8 justify-items-center"
						aria-label="Loading lists"
					>
						{[0, 1, 2, 3].map((k) => (
							<SkeletonCard
								key={k}
								className="w-full max-w-[720px] h-64 sm:h-72 lg:h-80 rounded-xl"
							/>
						))}
					</section>
				</PageFade>
			</main>
		);
	if (error && !list)
		return (
			<main className="px-6 py-8">
				<p className="text-red-600">{error}</p>
			</main>
		);
	if (!list)
		return (
			<main className="px-6 py-8">
				<p className="text-red-600">List not found.</p>
			</main>
		);

	return (
		<main className="px-6 py-8 max-w-2xl mx-auto space-y-6">
			<StarsBackground className="pointer-events-none fixed inset-0 z-0" />
			<Snowfall
				count={70}
				speed={40}
				wind={0.18}
				enableMeteors={true}
				meteorCount={3}
			/>
			<PageFade>
				<CountdownBanner initialNow={now0} />
				{/* Purchase Notification Modal */}
				{isOwner && showPurchaseModal && newPurchaseCount > 0 && (
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
								confetti({
									particleCount: 150,
									spread: 100,
									origin: { y: 0.5 },
									colors: ["#dc2626", "#ffffff", "#16a34a"],
									startVelocity: 45,
									gravity: 1.2,
								});
								// Auto-dismiss after 3 seconds
								setTimeout(() => {
									setShowPurchaseModal(false);
								}, 3000);
							}}
						>
							<div className="mx-4 p-8 rounded-xl bg-gradient-to-br from-emerald-900/90 to-emerald-950/90 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/20 backdrop-blur-md">
								<div className="text-center space-y-4">
									<div className="text-6xl">🎁</div>
									<h2 className="text-3xl font-bold text-white">Good News!</h2>
									<p className="text-xl text-emerald-200">
										<span className="font-bold text-2xl text-white">
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
				{/* Header */}
				<header className="space-y-1 text-center my-8">
					<motion.h1
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25 }}
						className="heading-festive text-6xl mb-2"
					>
						{list.title}
					</motion.h1>
					<p className="text-sm text-white/60">
						Created at: {new Date(list.created_at).toLocaleDateString()}
					</p>
				</header>
				{/* Share button - only show for owner */}
				{userId &&
					list &&
					userId === (list as any).owner_user_id &&
					familyGroupId && (
						<div className="py-2">
							<StatefulButton
								onClick={handleShareToggle}
								disabled={shareLoading}
								className="px-4 py-2 bg-emerald-700/80 text-white rounded-lg text-sm font-medium border border-emerald-700/50 hover:ring-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/60 disabled:opacity-50 transition-colors min-w-[180px]"
							>
								{isShared ? "Unshare from Family" : "Share to Family"}
							</StatefulButton>
						</div>
					)}
				{/* Toggle button shown when the form is collapsed - only for owner */}
				{isOwner && !formOpen ? (
					<div className="py-4">
						<button
							type="button"
							onClick={() => setFormOpen(true)}
							aria-expanded={formOpen}
							aria-controls="add-item-form"
							className="px-6 py-2 bg-black/70 text-white rounded-lg font-semibold border border-white/10 hover:bg-emerald-700/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black z-30"
						>
							Add item
						</button>
					</div>
				) : null}
				{isOwner && formOpen && (
					<AddItemForm
						open={formOpen}
						onOpenChange={setFormOpen}
						title={newTitle}
						setTitle={setNewTitle}
						price={newPrice}
						setPrice={setNewPrice}
						link={newLink}
						setLink={setNewLink}
						notes={newNotes}
						setNotes={setNewNotes}
						onSubmit={handleAdd}
						submitting={adding}
					/>
				)}
				{/* Error message */}
				{error && <p className="text-red-600 text-sm">{error}</p>}
				{/* Filter and Sort controls */}
				{items.length > 0 && (
					<div className="flex flex-wrap gap-3 justify-center mb-4">
						{/* On Sale Only toggle */}
						<button
							type="button"
							onClick={() => setShowOnSaleOnly(!showOnSaleOnly)}
							className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
								showOnSaleOnly
									? "bg-red-700/20 text-red-300 border-red-700/50 hover:bg-red-700/30 shadow-lg shadow-red-500/20 animate-pulse"
									: "bg-black/60 text-white/90 border-red-700/50 hover:border-red-700"
							}`}
						>
							🏷️ On Sale Only
						</button>
						{/* Most Wanted toggle */}
						<button
							type="button"
							onClick={() => setShowMostWantedOnly(!showMostWantedOnly)}
							className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-all ${
								showMostWantedOnly
									? "bg-emerald-700/20 text-emerald-300 border-emerald-700/50 hover:bg-emerald-700/30"
									: "bg-black/60 text-white/90 border-white/20 hover:border-white/40"
							}`}
						>
							<Snowflake className="h-4 w-4" />
							Most Wanted Only
						</button>
						{/* Sort dropdown */}
						<select
							value={sortBy}
							onChange={(e) =>
								setSortBy(
									e.target.value as "default" | "price-asc" | "price-desc"
								)
							}
							className="px-3 py-2 bg-black/60 text-white/90 text-sm rounded-lg border border-emerald-700/50 hover:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/60 transition-all cursor-pointer backdrop-blur-sm"
						>
							<option value="default">Sort: Default</option>
							<option value="price-asc">Price: Low to High</option>
							<option value="price-desc">Price: High to Low</option>
						</select>
					</div>
				)}
				{/* Items list */}
				<FestiveGlow>
					<ul className="space-y-2">
						{(() => {
							let sorted = [...items];

							// Filter logic: if both filters active, show items matching EITHER condition (OR)
							// If only one filter active, show items matching that condition
							if (showOnSaleOnly && showMostWantedOnly) {
								sorted = sorted.filter(
									(item) => item.on_sale === true || item.most_wanted === true
								);
							} else if (showOnSaleOnly) {
								sorted = sorted.filter((item) => item.on_sale === true);
							} else if (showMostWantedOnly) {
								sorted = sorted.filter((item) => item.most_wanted === true);
							}

							// Apply sorting
							if (sortBy === "price-asc") {
								sorted.sort((a, b) => {
									const aPrice = a.price_cents ?? Infinity;
									const bPrice = b.price_cents ?? Infinity;
									return aPrice - bPrice;
								});
							} else if (sortBy === "price-desc") {
								sorted.sort((a, b) => {
									const aPrice = a.price_cents ?? -Infinity;
									const bPrice = b.price_cents ?? -Infinity;
									return bPrice - aPrice;
								});
							}

							return sorted.map((it) => (
								<ItemRowCard
									key={it.id}
									item={it}
									onToggle={handleToggle}
									onDelete={handleDelete}
									onUpdate={handleUpdate}
									isOwner={userId === (list as any).owner_user_id}
								/>
							));
						})()}
					</ul>
				</FestiveGlow>
			</PageFade>
		</main>
	);
}
