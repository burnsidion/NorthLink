"use client";

import { useState } from "react";
import type { ItemRow } from "@/types/db";
import { toCents, normalizeUrl, usd } from "@/lib/format";
import { LinkPreview } from "@/components/ui/link-preview";
import { Snowflake } from "lucide-react";
import { StatefulCheckbox } from "@/components/ui/stateful-checkbox";
import { Button as StatefulButton } from "@/components/ui/stateful-button";

type Props = {
	item: ItemRow;
	onToggle: (id: string, nextPurchased: boolean) => Promise<void> | void;
	onDelete: (id: string) => Promise<void> | void;
	onUpdate: (
		id: string,
		patch: Partial<
			Pick<ItemRow, "title" | "price_cents" | "link" | "notes" | "most_wanted">
		>
	) => Promise<void> | void;
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
		setSaving(true);
		try {
			await onUpdate(item.id, {
				title: title.trim(),
				price_cents: toCents(price),
				link: normalizeUrl(link),
				notes: notes.trim() || null,
			});
			setEditing(false);
		} finally {
			setSaving(false);
		}
	};

	return (
		<li className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/2 px-3 py-2">
			<StatefulCheckbox
				checked={item.purchased ?? false}
				onChange={() => onToggle(item.id, !item.purchased)}
				ariaLabel={item.purchased ? "Mark unpurchased" : "Mark purchased"}
			/>

			<div className="flex-1">
				{editing ? (
					<div className="space-y-2">
						<div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
							<input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Title"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
							<input
								value={price}
								onChange={(e) => setPrice(e.target.value)}
								placeholder="Price (e.g. 24.99)"
								inputMode="decimal"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
							<input
								value={link}
								onChange={(e) => setLink(e.target.value)}
								placeholder="Link"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
							<input
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Notes"
								className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
							/>
						</div>

						<div className="flex gap-2">
							<StatefulButton
								onClick={saveEdit}
								disabled={saving}
								className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm hover:ring-emerald-700 disabled:opacity-60 min-w-[80px]"
							>
								Save
							</StatefulButton>
							<button
								onClick={cancelEdit}
								className="rounded-lg border border-white/10 bg-red-600 px-3 py-1.5 text-sm hover:bg-red-600"
							>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<div>
						<div className="flex items-center gap-2 justify-between">
							<div className="flex items-center gap-2">
								<span
									className={item.purchased ? "line-through text-white/50" : ""}
								>
									{item.title}
								</span>
								{!isOwner && item.most_wanted && (
									<Snowflake
										className="h-4 w-4 text-cyan-400"
										aria-label="Most Wanted"
									/>
								)}
							</div>
							<div className="flex gap-4 items-center">
								{isOwner && (
									<div className="flex items-center gap-1.5">
										<label className="text-xs text-white/60">Most Wanted</label>
										<input
											type="checkbox"
											checked={item.most_wanted ?? false}
											onChange={async (e) => {
												const newValue = e.target.checked;
												console.log("Most Wanted checkbox clicked:", {
													itemId: item.id,
													itemTitle: item.title,
													newValue,
													currentValue: item.most_wanted,
												});
												await onUpdate(item.id, { most_wanted: newValue });
											}}
											className="h-4 w-4 rounded border-white/20 bg-transparent checked:bg-amber-500 checked:border-amber-500 cursor-pointer"
										/>
									</div>
								)}
								{typeof item.price_cents === "number" && (
									<span className="text-xs text-white/60">
										· {usd.format(item.price_cents / 100)}
									</span>
								)}
								{item.link && (
									<LinkPreview
										url={item.link}
										className="underline hover:text-white text-sm"
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
									onClick={() => onDelete(item.id)}
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
