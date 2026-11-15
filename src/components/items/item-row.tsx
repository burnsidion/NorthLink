"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemRow } from "@/types/db";
import { toCents, normalizeUrl, usd } from "@/lib/format";
import { LinkPreview } from "@/components/ui/link-preview";
import { Snowflake } from "lucide-react";
import { StatefulCheckbox } from "@/components/ui/stateful-checkbox";
import { cn } from "@/lib/utils";

type Props = {
	item: ItemRow;
	onToggle: (id: string, nextPurchased: boolean) => Promise<boolean>;
	onDelete: (id: string) => Promise<boolean>;
	onUpdate: (
		id: string,
		patch: Partial<
			Pick<
				ItemRow,
				"title" | "price_cents" | "link" | "notes" | "most_wanted" | "on_sale"
			>
		>
	) => Promise<boolean>;
	isOwner?: boolean;
};

export default function ItemRow({
	item,
	onToggle,
	onDelete,
	onUpdate,
	isOwner = true,
}: Props) {
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);

	const busy = useRef(false);
	const mounted = useRef(false);
	useEffect(() => {
		mounted.current = true;
		return () => { mounted.current = false; };
	}, []);

	async function runChange(action: () => Promise<boolean>): Promise<boolean> {
		if (!mounted.current || busy.current) return false;
		busy.current = true;
		setSaving(true);
		setEditError(null);
		try {
			const saved = await action();
			if (mounted.current && !saved) setEditError("Couldn’t confirm this change. Check its current status before trying again.");
			return saved;
		} catch (error) {
			if (mounted.current) setEditError(error instanceof Error ? error.message : "Could not save this gift.");
			return false;
		} finally {
			busy.current = false;
			if (mounted.current) setSaving(false);
		}
	}

	// local edit fields
	const [title, setTitle] = useState(item.title ?? "");
	const [price, setPrice] = useState(
		typeof item.price_cents === "number"
			? String((item.price_cents / 100).toFixed(2))
			: ""
	);
	const [link, setLink] = useState(item.link ?? "");
	const [notes, setNotes] = useState(item.notes ?? "");

	const beginEdit = () => setEditing(true);
	const cancelEdit = () => {
		setEditing(false);
		// reset to original values
		setTitle(item.title ?? "");
		setPrice(
			typeof item.price_cents === "number"
				? String((item.price_cents / 100).toFixed(2))
				: ""
		);
		setLink(item.link ?? "");
		setNotes(item.notes ?? "");
	};

	const saveEdit = async () => {
		const saved = await runChange(() => onUpdate(item.id, {
			title: title.trim(), price_cents: toCents(price),
			link: normalizeUrl(link), notes: notes.trim() || null,
		}));
		if (mounted.current && saved) setEditing(false);
	};

	return (
		<li
			className={cn(
				"flex items-start gap-3 rounded-lg border px-3 py-2 transition-all duration-300",
				item.on_sale
					? "border-orange-500/60 bg-orange-950/10 shadow-lg shadow-orange-500/20 animate-pulse"
					: "border-white/10 bg-white/2"
			)}
		>
			<StatefulCheckbox
				checked={item.purchased ?? false}
				onChange={() => onToggle(item.id, !item.purchased)}
				ariaLabel={item.purchased ? "Mark unpurchased" : "Mark purchased"}
				showMultiStepLoader={!isOwner}
			/>

			<div className="flex-1">
				{editError && <p role="alert">{editError}</p>}
				{editing ? (
					<div className="space-y-2">
						<div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
							<input
								disabled={saving}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Title"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
							<input
								disabled={saving}
								value={price}
								onChange={(e) => setPrice(e.target.value)}
								placeholder="Price (e.g. 24.99)"
								inputMode="decimal"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
							<input
								disabled={saving}
								value={link}
								onChange={(e) => setLink(e.target.value)}
								placeholder="Link"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
							<input
								disabled={saving}
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Notes"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
						</div>

						<div className="flex gap-2">
							<button
								onClick={saveEdit}
								disabled={saving}
								className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm hover:ring-emerald-700 disabled:opacity-60 min-w-20"
							>
								{saving ? "Saving…" : "Save"}
							</button>
							<button
								disabled={saving}
								onClick={cancelEdit}
								className="rounded-lg border border-white/10 bg-red-600 px-3 py-1.5 text-sm hover:bg-red-600"
							>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<div>
						<div className="flex items-start gap-2 justify-between flex-wrap">
							<span
								className={item.purchased ? "line-through text-white/50" : ""}
							>
								{item.title}
							</span>
							<div className="flex items-center gap-2 flex-wrap justify-between">
								{!isOwner && item.most_wanted && (
									<Snowflake
										className="h-4 w-4 text-cyan-400"
										aria-label="Most Wanted"
									/>
								)}
								{!isOwner && item.on_sale && (
									<span
										className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-600/90 text-white text-xs font-medium ring-1 ring-orange-500/50"
										aria-label="On Sale"
									>
										🏷️ On Sale
									</span>
								)}
							</div>
							<div className="flex gap-2 sm:gap-4 items-center flex-wrap w-full justify-between">
								{isOwner && (
									<div className="flex items-center gap-2 flex-wrap">
										<button type="button" disabled={saving} aria-pressed={item.on_sale ?? false}
											className={cn("rounded-md px-2 py-1 text-xs border disabled:opacity-50", item.on_sale ? "bg-orange-600/90 border-orange-500" : "bg-white/5 border-white/10")}
											onClick={() => runChange(() => onUpdate(item.id, { on_sale: !item.on_sale }))}>
											On Sale
										</button>
										<div className="flex items-center gap-1.5">
											<label className="text-xs text-white/60 hidden sm:inline">
												Most Wanted
											</label>
											<label
												className="text-xs text-white/60 sm:hidden"
												title="Most Wanted"
											>
												❄️
											</label>
											<input
												disabled={saving}
												type="checkbox"
												checked={item.most_wanted ?? false}
												onChange={(e) => { const next = e.target.checked; void runChange(() => onUpdate(item.id, { most_wanted: next })); }}
												className="h-4 w-4 rounded border-white/20 bg-transparent checked:bg-amber-500 checked:border-amber-500 cursor-pointer"
											/>
										</div>
									</div>
								)}
								{typeof item.price_cents === "number" && (
									<span className="text-sm text-emerald-400 font-medium whitespace-nowrap">
										· {usd.format(item.price_cents / 100)}
									</span>
								)}
								{item.link && (
									<LinkPreview
										url={item.link}
										className="underline hover:text-white text-sm whitespace-nowrap"
									>
										View
									</LinkPreview>
								)}
							</div>
						</div>{" "}
						{(item.link || item.notes) && (
							<div className="mt-1 text-sm text-white/70 space-x-2 grid">
								<p>Notes:</p>
								{item.notes && <span className="opacity-80">{item.notes}</span>}
							</div>
						)}
						{/* Show Edit/Delete only for owner, and only Edit button if item is not purchased */}
						{isOwner && (
							<div className="mt-2 flex gap-2">
								{!item.purchased && (
									<button
										onClick={beginEdit}
										className="text-sm rounded-lg bg-emerald-700 hover:bg-emerald-700 text-white px-2 py-1"
									>
										Edit
									</button>
								)}
								<button
									disabled={saving}
									onClick={() => runChange(() => onDelete(item.id))}
									className="text-sm rounded-lg bg-red-600/80 hover:bg-red-600 text-white px-2 py-1"
								>
									Delete
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</li>
	);
}
