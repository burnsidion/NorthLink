"use client";

//React
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { links } from "@/config/nav-links";

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
				router.push("/signin");
				return;
			}

			// Load list + items
			const [
				{ data: theList, error: listErr },
				{ data: theItems, error: itemsErr },
			] = await Promise.all([
				supabase
					.from("lists")
					.select("id,title,created_at")
					.eq("id", id)
					.single(),
				supabase
					.from("items")
					.select(
						"id,list_id,title,purchased,created_at,price_cents,link,notes"
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
			.select("id,list_id,title,purchased,created_at,price_cents,link,notes")
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
		} catch (e: any) {
			setItems(prev); // revert
			setError(e?.message ?? String(e));
		} finally {
			await refreshItems();
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

	if (loading)
		return (
			<main className="relative min-h-screen px-6 py-8 space-y-6 overflow-hidden">
				<PageFade>
					<StarsBackground starColor="var(--stars-dim)" />
					<Snowfall
						className="pointer-events-none fixed inset-0 z-0"
						count={70}
						speed={40}
						wind={0.18}
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
			<StarsBackground
				starColor="var(--stars-dim)"
				className="pointer-events-none fixed inset-0 z-0"
			/>
			<Snowfall count={70} speed={40} wind={0.18} />
			<PageFade>
				<CountdownBanner initialNow={now0} />
				{/* Header */}
				<header className="space-y-1">
					<motion.h1
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25 }}
						className="text-4xl mb-2"
					>
						{list.title}
					</motion.h1>
					<p className="text-sm text-white/60">
						Created at: {new Date(list.created_at).toLocaleString()}
					</p>
				</header>
				{/* Toggle button shown when the form is collapsed */}
				{!formOpen ? (
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
				{formOpen && (
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
				{/* Items list */}
				<FestiveGlow>
					<ul className="space-y-2">
						{items.map((it) => (
							<ItemRowCard
								key={it.id}
								item={it}
								onToggle={handleToggle}
								onDelete={handleDelete}
								onUpdate={handleUpdate}
							/>
						))}
					</ul>
				</FestiveGlow>
			</PageFade>
		</main>
	);
}
