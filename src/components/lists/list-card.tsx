"use client";

import Link from "next/link";
import { GlareCard } from "@/components/ui/glare-card";
import { IconCalendar, IconGift } from "@tabler/icons-react";
import { EditOutlined } from "@ant-design/icons";

export type ListWithProgress = {
	id: string;
	title: string;
	owner_display_name?: string;
	owner_avatar_url?: string;
	created_at: string;
	total?: number;
	purchased?: number;
};

type Props = {
	list: ListWithProgress;
	onManage?: (id: string, title: string) => void;
	showOwner?: boolean;
	hideManageButton?: boolean;
	index?: number;
};

export default function ListCard({
	list: l,
	onManage,
	showOwner = false,
	hideManageButton = false,
	index = 0,
}: Props) {
	const purchased = l.purchased ?? 0;
	const total = l.total ?? 0;
	const pct = ((purchased / Math.max(total, 1)) * 100).toFixed(1);
	const isGreen = index % 2 === 0;

	return (
		<GlareCard
			containerClassName="h-64 sm:h-72 lg:h-80"
			color={isGreen ? "emerald" : "red"}
		>
			<div
				className={`relative flex flex-col justify-between h-full w-full p-4 rounded-xl ${
					isGreen
						? "bg-linear-to-br from-emerald-900/40 to-emerald-950/30"
						: "bg-linear-to-br from-red-700/50 to-red-900/40"
				}`}
			>
				{/* Title + manage */}
				<div className="flex flex-col items-center">
					<h2 className="heading-festive text-5xl font-semibold text-white wrap-break-word">
						{l.title}
					</h2>
					{showOwner && l.owner_display_name && (
						<div className="mt-2 flex items-center gap-2">
							{l.owner_avatar_url && (
								<img
									src={l.owner_avatar_url}
									alt={l.owner_display_name}
									className="w-6 h-6 rounded-full"
								/>
							)}
							<p className="text-sm text-white/70">By {l.owner_display_name}</p>
						</div>
					)}
					{!hideManageButton && onManage && (
						<button
							onClick={() => onManage(l.id, l.title)}
							aria-label={`Manage list ${l.title}`}
							className="absolute right-1.5 top-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
						>
							<EditOutlined className="text-white/90" />
						</button>
					)}
				</div>
				{/* Meta row */}
				<div className="flex items-center gap-4 my-6">
					<div className="flex items-center gap-2 text-white/70">
						<IconCalendar className="h-4 w-4 shrink-0" aria-hidden />
						<time dateTime={l.created_at}>
							{new Date(l.created_at).toLocaleDateString()}
						</time>
					</div>
					<div className="flex items-center gap-2 text-white/70">
						<IconGift className="h-4 w-4 shrink-0" aria-hidden />
						<span aria-label="Total items">{total} items</span>
					</div>
				</div>
				{/* Progress */}
				<div className="flex items-center justify-between">
					<p className="text-sm text-white/70 mb-2">Progress</p>
					<p className="text-sm text-white/70 mb-2">
						{purchased} / {total} items purchased
					</p>
				</div>
				<div
					role="progressbar"
					aria-label="List purchase progress"
					aria-valuemin={0}
					aria-valuemax={total}
					aria-valuenow={purchased}
					className="w-full h-2 bg-white/10 rounded-full overflow-hidden shadow-[0_0_8px_rgba(220,38,38,0.4)]"
				>
					<div
						className="h-full transition-all duration-300 animate-candy-cane shadow-[0_0_6px_rgba(255,255,255,0.6)]"
						style={{
							width: `${pct}%`,
							background:
								"repeating-linear-gradient(90deg, white 0px, white 8px, #dc2626 8px, #dc2626 16px)",
						}}
					/>
				</div>{" "}
				{/* CTA */}
				<div className="mt-auto">
					<Link
						href={`/lists/${l.id}`}
						aria-label={`View list ${l.title}`}
						className={`block w-full text-center px-3 py-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black text-sm font-medium ${
							isGreen
								? "bg-red-600/80 hover:bg-red-600"
								: "bg-emerald-600/80 hover:bg-emerald-600"
						}`}
					>
						View List
					</Link>
				</div>
			</div>
		</GlareCard>
	);
}
