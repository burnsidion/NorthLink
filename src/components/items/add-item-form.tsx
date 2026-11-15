"use client";

import * as React from "react";

type Props = {
	/** collapsed/expanded */
	open: boolean;
	/** called when user clicks Add item / Cancel */
	onOpenChange: (next: boolean) => void;

	// controlled inputs (lifted state lives in page.tsx)
	title: string;
	setTitle: (v: string) => void;

	price: string;
	setPrice: (v: string) => void;

	link: string;
	setLink: (v: string) => void;

	notes: string;
	setNotes: (v: string) => void;

	// submit
	onSubmit: (e: React.FormEvent) => void;
	submitting?: boolean;
};

export default function AddItemForm({
	open,
	onOpenChange,
	title,
	setTitle,
	price,
	setPrice,
	link,
	setLink,
	notes,
	setNotes,
	onSubmit,
	submitting,
}: Props) {
	// When collapsed, show the simple “Add item” button
	if (!open) {
		return (
			<div className="pt-2">
				<button
					type="button"
					onClick={() => onOpenChange(true)}
					aria-expanded={open}
					aria-controls="add-item-form"
					className="ledger-button"
				>
					Add item
				</button>
			</div>
		);
	}

	// Expanded form
	return (
		<form id="add-item-form" onSubmit={onSubmit} className="ledger-add-form">
			<input
				disabled={submitting}
				name="title"
				aria-label="Gift name"
				placeholder="Item Name"
				maxLength={120}
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				className="ledger-input"
			/>

			<div className="ledger-form-fields">
				<input
				disabled={submitting}
					name="price"
					aria-label="Price"
					inputMode="decimal"
					placeholder="Price (e.g. 24.99)"
					value={price}
					onChange={(e) => setPrice(e.target.value)}
					className="ledger-input"
				/>
				<input
				disabled={submitting}
					name="link"
					aria-label="Shop link"
					placeholder="Link (amazon.com/…)"
					value={link}
					onChange={(e) => setLink(e.target.value)}
					className="ledger-input"
				/>
				<input
				disabled={submitting}
					name="notes"
					aria-label="Notes"
					placeholder="Notes (size, color, etc.)"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					className="ledger-input"
				/>
			</div>

			<div className="ledger-inline-actions">
				<button
					type="submit"
					disabled={!!submitting}
					className="ledger-button"
				>
					{submitting ? "Saving…" : "Save"}
				</button>
				<button
					className="ledger-secondary"
					type="button"
					disabled={submitting}
					onClick={() => onOpenChange(false)}
				>
					Cancel
				</button>
			</div>
		</form>
	);
}
