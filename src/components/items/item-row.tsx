"use client";

import { useEffect, useRef, useState } from "react";
import type { ItemRow } from "@/types/db";
import { toCents, normalizeUrl, safeWebUrl, usd } from "@/lib/format";
import { StatefulCheckbox } from "@/components/ui/stateful-checkbox";

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
	const giftLink = safeWebUrl(item.link);
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
		<li className="ledger-gift-row" data-purchased={item.purchased}>
			<StatefulCheckbox className="ledger-purchase" checked={item.purchased ?? false}
				onChange={() => onToggle(item.id, !item.purchased)}
				ariaLabel={item.purchased ? "Mark unpurchased" : "Mark purchased"} showMultiStepLoader={!isOwner} />
			<div className="ledger-gift-content">
				{editError && <p role="alert" className="ledger-error">{editError}</p>}
				{editing ? (
					<div className="ledger-gift-editor">
						<div className="ledger-form-fields">
							<label>Gift name<input aria-label="Gift name" disabled={saving} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="ledger-input" /></label>
							<label>Price<input aria-label="Price" disabled={saving} value={price} onChange={e => setPrice(e.target.value)} placeholder="Price (e.g. 24.99)" inputMode="decimal" className="ledger-input" /></label>
							<label>Shop link<input aria-label="Shop link" disabled={saving} value={link} onChange={e => setLink(e.target.value)} placeholder="Link" className="ledger-input" /></label>
							<label>Notes<input aria-label="Notes" disabled={saving} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" className="ledger-input" /></label>
						</div>
						<div className="ledger-inline-actions">
							<button onClick={saveEdit} disabled={saving} className="ledger-button">{saving ? "Saving…" : "Save"}</button>
							<button disabled={saving} onClick={cancelEdit} className="ledger-secondary">Cancel</button>
						</div>
					</div>
				) : (
					<>
						<div className="ledger-gift-heading"><h2>{item.title}</h2>
							{typeof item.price_cents === "number" && <span className="ledger-gift-price">{usd.format(item.price_cents / 100)}</span>}
						</div>
						<div className="ledger-gift-badges">
							{item.most_wanted && <span className="ledger-badge" aria-label="Most Wanted">✦ Most Wanted</span>}
							{item.on_sale && <span className="ledger-badge ledger-badge-sale" aria-label="On Sale">On Sale</span>}
						</div>
						{item.notes && <p className="ledger-gift-notes">{item.notes}</p>}
						<div className="ledger-inline-actions">
							{giftLink && <a href={giftLink} target="_blank" rel="noopener noreferrer" className="ledger-shop-link">View</a>}
							{isOwner && <>
								{!item.purchased && <button onClick={beginEdit} disabled={saving} className="ledger-text-button">Edit</button>}
								<button disabled={saving} onClick={() => runChange(() => onDelete(item.id))} className="ledger-text-button ledger-text-danger">Delete</button>
							</>}
						</div>
						{isOwner && <div className="ledger-owner-flags">
							<button type="button" disabled={saving} aria-pressed={item.on_sale ?? false} className="ledger-filter"
								onClick={() => runChange(() => onUpdate(item.id, { on_sale: !item.on_sale }))}>On Sale</button>
							<label><input disabled={saving} type="checkbox" checked={item.most_wanted ?? false}
								onChange={e => { const next = e.target.checked; void runChange(() => onUpdate(item.id, { most_wanted: next })); }} /> Most Wanted</label>
						</div>}
					</>
				)}
			</div>
		</li>
	);
}
