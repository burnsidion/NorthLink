"use client";

import { useState } from "react";
import type { ItemRow } from "@/types/db";
import { toCents, normalizeUrl, usd } from "@/lib/format";
import { LinkPreview } from "@/components/ui/link-preview";
import { Snowflake } from "lucide-react";
import { StatefulCheckbox } from "@/components/ui/stateful-checkbox";
import { Button as StatefulButton } from "@/components/ui/stateful-button";
import { motion, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

/** Stateful On Sale Toggle Button */
function OnSaleToggle({
	isOnSale,
	onClick,
}: {
	isOnSale: boolean;
	onClick: () => Promise<void>;
}) {
	const [scope, animate] = useAnimate();

	const animateLoading = async () => {
		await animate(
			".loader",
			{
				width: "12px",
				scale: 1,
				display: "block",
			},
			{
				duration: 0.15,
			}
		);
	};

	const animateSuccess = async () => {
		await animate(
			".loader",
			{
				width: "0px",
				scale: 0,
				display: "none",
			},
			{
				duration: 0.15,
			}
		);
		await animate(
			".check",
			{
				width: "12px",
				scale: 1,
				display: "block",
			},
			{
				duration: 0.15,
			}
		);

		await animate(
			".check",
			{
				width: "0px",
				scale: 0,
				display: "none",
			},
			{
				delay: 1.5,
				duration: 0.15,
			}
		);
	};

	const handleClick = async () => {
		await animateLoading();
		await onClick();
		await animateSuccess();
	};

	return (
		<motion.button
			layout
			ref={scope}
			onClick={handleClick}
			className={cn(
				"flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all duration-200",
				isOnSale
					? "bg-orange-600/90 text-white ring-1 ring-orange-500/50 hover:ring-2 hover:ring-orange-500"
					: "bg-white/5 text-white/60 ring-1 ring-white/10 hover:ring-white/20 hover:text-white/80"
			)}
		>
			<motion.div layout className="flex items-center gap-1.5">
				<Loader />
				<CheckIcon />
				<motion.span layout>On Sale</motion.span>
			</motion.div>
		</motion.button>
	);
}

const Loader = () => {
	return (
		<motion.svg
			animate={{
				rotate: [0, 360],
			}}
			initial={{
				scale: 0,
				width: 0,
				display: "none",
			}}
			style={{
				scale: 0.5,
				display: "none",
			}}
			transition={{
				duration: 0.3,
				repeat: Infinity,
				ease: "linear",
			}}
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="loader text-white"
		>
			<path stroke="none" d="M0 0h24v24H0z" fill="none" />
			<path d="M12 3a9 9 0 1 0 9 9" />
		</motion.svg>
	);
};

const CheckIcon = () => {
	return (
		<motion.svg
			initial={{
				scale: 0,
				width: 0,
				display: "none",
			}}
			style={{
				scale: 0.5,
				display: "none",
			}}
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="check text-white"
		>
			<path stroke="none" d="M0 0h24v24H0z" fill="none" />
			<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
			<path d="M9 12l2 2l4 -4" />
		</motion.svg>
	);
};

type Props = {
	item: ItemRow;
	onToggle: (id: string, nextPurchased: boolean) => Promise<void> | void;
	onDelete: (id: string) => Promise<void> | void;
	onUpdate: (
		id: string,
		patch: Partial<
			Pick<
				ItemRow,
				"title" | "price_cents" | "link" | "notes" | "most_wanted" | "on_sale"
			>
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
								className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm hover:ring-emerald-700 disabled:opacity-60 min-w-20"
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
										<OnSaleToggle
											isOnSale={item.on_sale ?? false}
											onClick={async () => {
												const newValue = !item.on_sale;
												console.log("On Sale toggle clicked:", {
													itemId: item.id,
													itemTitle: item.title,
													newValue,
													currentValue: item.on_sale,
												});
												await onUpdate(item.id, { on_sale: newValue });
											}}
										/>
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
