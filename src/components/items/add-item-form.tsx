"use client";

import * as React from "react";
import { ShinyButton } from "@/components/ui/shiny-button";
import { Button as StatefulButton } from "@/components/ui/stateful-button";

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
					className="px-6 py-2 bg-black/70 text-white rounded-lg font-semibold border border-white/10 hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
				>
					Add item
				</button>
			</div>
		);
	}

	// Expanded form
	return (
		<form id="add-item-form" onSubmit={onSubmit} className="space-y-3">
			<input
				name="title"
				placeholder="Item Name"
				maxLength={120}
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				className="w-full rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-700/40"
			/>

			<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
				<input
					name="price"
					inputMode="decimal"
					placeholder="Price (e.g. 24.99)"
					value={price}
					onChange={(e) => setPrice(e.target.value)}
					className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
				/>
				<input
					name="link"
					placeholder="Link (amazon.com/…)"
					value={link}
					onChange={(e) => setLink(e.target.value)}
					className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
				/>
				<input
					name="notes"
					placeholder="Notes (size, color, etc.)"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					className="rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-700/40"
				/>
			</div>

			<div className="flex flex-col sm:flex-row gap-2">
				<StatefulButton
					type="submit"
					disabled={!!submitting}
					className="w-full sm:w-auto h-11 bg-emerald-700 hover:ring-emerald-700"
				>
					Save
				</StatefulButton>
				<ShinyButton
					className="w-full sm:w-auto h-11 hover:bg-red-700/60"
					type="button"
					onClick={() => onOpenChange(false)}
				>
					Cancel
				</ShinyButton>
			</div>
		</form>
	);
}
