"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

//Ui components
import { FestiveGlow } from "@/components/ui/festive-glow";
import Snowfall from "@/components/ui/snowfall";
import CountdownBanner from "@/components/ui/countdown-banner";
import { ShinyButton } from "@/components/ui/shiny-button";
import { TextAnimate } from "@/components/ui/text-animate";

type ListRow = { id: string; title: string; created_at: string };
type ItemRow = {
	id: string;
	list_id: string;
	title: string;
	purchased: boolean;
	created_at: string;
	price_cents: number | null;
	link: string | null;
	notes: string | null;
};

export default function ListDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();

	// state
	const [list, setList] = useState<ListRow | null>(null);
	const [items, setItems] = useState<ItemRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// form state
	const [newName, setNewName] = useState("");
	const [adding, setAdding] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newPrice, setNewPrice] = useState("");
	const [newLink, setNewLink] = useState("");
	const [newNotes, setNewNotes] = useState("");
	const [formOpen, setFormOpen] = useState(false);

	// edit state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editPrice, setEditPrice] = useState("");
	const [editLink, setEditLink] = useState("");
	const [editNotes, setEditNotes] = useState("");
	const [savingEdit, setSavingEdit] = useState(false);

	const toCents = (v: string) => {
		const n = Number(v.replace(/[^0-9.]/g, ""));
		return Number.isFinite(n) ? Math.round(n * 100) : null;
	};

	const normalizeUrl = (v: string) => {
		if (!v.trim()) return null;
		try {
			const u = new URL(v.match(/^https?:\/\//) ? v : "https://" + v);
			return u.toString();
		} catch {
			return null;
		}
	};

	const fmt = new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
	});

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

	async function handleAdd(e: React.FormEvent) {
		e.preventDefault();
		const title = newTitle.trim();
		if (!title || !list) return;

		setAdding(true);
		setError(null);

		try {
			const { data: inserted, error: insertErr } = await supabase
				.from("items")
				.insert({
					list_id: list.id,
					title,
					price_cents: toCents(newPrice),
					link: normalizeUrl(newLink),
					notes: newNotes.trim() || null,
				})
				.select()
				.single();

			if (insertErr) throw insertErr;

			setItems((prev) => [...prev, inserted as ItemRow]);
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
		// optimistic update
		setItems((prev) =>
			prev.map((it) =>
				it.id === idToToggle ? { ...it, purchased: nextPurchased } : it
			)
		);

		const { error: updErr } = await supabase
			.from("items")
			.update({ purchased: nextPurchased })
			.eq("id", idToToggle);

		if (updErr) {
			// revert
			setItems((prev) =>
				prev.map((it) =>
					it.id === idToToggle ? { ...it, purchased: !nextPurchased } : it
				)
			);
			setError(updErr.message);
		}
	}

	async function handleDelete(idToDelete: string) {
		// optimistic remove
		const prev = items;
		setItems((p) => p.filter((it) => it.id !== idToDelete));

		const { error: delErr } = await supabase
			.from("items")
			.delete()
			.eq("id", idToDelete);

		if (delErr) {
			setItems(prev); // revert
			setError(delErr.message);
		}
	}

	function beginEdit(it: ItemRow) {
		setEditingId(it.id);
		setEditTitle(it.title ?? "");
		setEditPrice(
			typeof it.price_cents === "number" ? String((it.price_cents / 100).toFixed(2)) : ""
		);
		setEditLink(it.link ?? "");
		setEditNotes(it.notes ?? "");
	}

	function cancelEdit() {
		setEditingId(null);
		setEditTitle("");
		setEditPrice("");
		setEditLink("");
		setEditNotes("");
	}

	async function saveEdit() {
		if (!editingId) return;
		setSavingEdit(true);

		// capture old for revert
		const prev = items;
		const priceCents = toCents(editPrice);
		const linkNorm = normalizeUrl(editLink);

		// optimistic update
		setItems((p) =>
			p.map((it) =>
				it.id === editingId
					? { ...it, title: editTitle.trim(), price_cents: priceCents, link: linkNorm, notes: editNotes.trim() || null }
					: it
			)
		);

		const { error: updErr } = await supabase
			.from("items")
			.update({
				title: editTitle.trim(),
				price_cents: priceCents,
				link: linkNorm,
				notes: editNotes.trim() || null,
			})
			.eq("id", editingId);

		if (updErr) {
			// revert and surface error
			setItems(prev);
			setError(updErr.message);
			setSavingEdit(false);
			return;
		}

		setSavingEdit(false);
		cancelEdit();
	}

	if (loading) return <main className="px-6 py-8 text-white/80">Loading…</main>;
	if (error && !list)
		return (
			<main className="px-6 py-8">
				<p className="text-red-400">{error}</p>
			</main>
		);
	if (!list)
		return (
			<main className="px-6 py-8">
				<p className="text-red-400">List not found.</p>
			</main>
		);

	return (
		<main className="px-6 py-8 max-w-2xl mx-auto space-y-6">
			<Snowfall />
			<CountdownBanner initialNow={Date.now()} />
			{/* Header */}
			<header className="space-y-1">
				<TextAnimate
					animation="blurInUp"
					by="character"
					once
					className="text-2xl font-semibold"
				>
					{list.title}
				</TextAnimate>
				<p className="text-sm text-white/60">
					Created at: {new Date(list.created_at).toLocaleString()}
				</p>
			</header>

			{/* Toggle button shown when the form is collapsed */}
			{!formOpen ? (
				<div className="pt-2">
					<button
						type="button"
						onClick={() => setFormOpen(true)}
						aria-expanded={formOpen}
						aria-controls="add-item-form"
						className="px-6 py-2 bg-black/70 text-white rounded-lg font-semibold border border-white/10 hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
					>
						Add item
					</button>
				</div>
			) : null}

			{formOpen && (
				<form id="add-item-form" onSubmit={handleAdd} className="space-y-3">
					<div className="flex flex-col sm:flex-row gap-2">
						<input
							name="title"
							placeholder="Item Name"
							maxLength={120}
							value={newTitle}
							onChange={(e) => setNewTitle(e.target.value)}
							className="flex-1 min-w-0 rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-400/40"
						/>
						<ShinyButton disabled={adding} className="w-full sm:w-auto h-11">
							{" "}
							{adding ? "Adding…" : "Save"}{" "}
						</ShinyButton>
						<button
							type="button"
							onClick={() => setFormOpen(false)}
							className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ml-2"
						>
							Cancel
						</button>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
						<input
							name="price"
							inputMode="decimal"
							placeholder="Price (e.g. 24.99)"
							value={newPrice}
							onChange={(e) => setNewPrice(e.target.value)}
							className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
						/>
						<input
							name="link"
							placeholder="Link (amazon.com/…)"
							value={newLink}
							onChange={(e) => setNewLink(e.target.value)}
							className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
						/>
						<input
							name="notes"
							placeholder="Notes (size, color, etc.)"
							value={newNotes}
							onChange={(e) => setNewNotes(e.target.value)}
							className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
						/>
					</div>
				</form>
			)}

			{/* Error message */}
			{error && <p className="text-red-400 text-sm">{error}</p>}

			{/* Items list */}
			<FestiveGlow>
				<ul className="space-y-2">
					{items.map((it) => (
						<li
							key={it.id}
							className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/2 px-3 py-2"
						>
							<button
								type="button"
								aria-label={
									it.purchased ? "Mark unpurchased" : "Mark purchased"
								}
								onClick={() => handleToggle(it.id, !it.purchased)}
								className={`mt-1 h-5 w-5 rounded border ${
									it.purchased
										? "bg-emerald-400/80 border-emerald-300"
										: "border-white/20"
								}`}
							/>
							<div className="flex-1">
								{editingId === it.id ? (
									// EDIT MODE
									<div className="space-y-2">
										<div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
											<input
												value={editTitle}
												onChange={(e) => setEditTitle(e.target.value)}
												placeholder="Title"
												className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
											/>
											<input
												value={editPrice}
												onChange={(e) => setEditPrice(e.target.value)}
												placeholder="Price (e.g. 24.99)"
												inputMode="decimal"
												className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
											/>
											<input
												value={editLink}
												onChange={(e) => setEditLink(e.target.value)}
												placeholder="Link"
												className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
											/>
											<input
												value={editNotes}
												onChange={(e) => setEditNotes(e.target.value)}
												placeholder="Notes"
												className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
											/>
										</div>
										<div className="flex gap-2">
											<button
												onClick={saveEdit}
												disabled={savingEdit}
												className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500 disabled:opacity-60"
											>
												{savingEdit ? "Saving…" : "Save"}
											</button>
											<button
												onClick={cancelEdit}
												className="rounded-lg border border-white/10 bg-red-600 px-3 py-1.5 text-sm hover:bg-red-500"
											>
												Cancel
											</button>
										</div>
									</div>
								) : (
									// VIEW MODE
									<div>
										<div className="flex items-center gap-2">
											<span className={it.purchased ? "line-through text-white/50" : ""}>
												{it.title}
											</span>
											{typeof it.price_cents === "number" && (
												<span className="text-xs text-white/60">· {fmt.format(it.price_cents / 100)}</span>
											)}
										</div>
										{(it.link || it.notes) && (
											<div className="mt-1 text-sm text-white/70 space-x-2">
												{it.link && (
													<a href={it.link} target="_blank" rel="noreferrer" className="underline hover:text-white">
														View
													</a>
												)}
												{it.notes && <span className="opacity-80">{it.notes}</span>}
											</div>
										)}
										<div className="mt-2 flex gap-2">
											<button
												onClick={() => beginEdit(it)}
												className="text-sm rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white px-2 py-1"
											>
												Edit
											</button>
											<button
												onClick={() => handleDelete(it.id)}
												className="text-sm rounded-lg bg-red-500/80 hover:bg-red-400 text-white px-2 py-1"
											>
												Delete
											</button>
										</div>
									</div>
								)}
							</div>
						</li>
					))}
				</ul>
			</FestiveGlow>
		</main>
	);
}
