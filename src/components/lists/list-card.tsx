"use client";

import Link from "next/link";
import { GlareCard } from "@/components/ui/glare-card";
import { IconCalendar, IconGift } from "@tabler/icons-react";
import { EditOutlined } from "@ant-design/icons";

export type ListWithProgress = {
	id: string;
	title: string;
	owner_display_name?: string;
	created_at: string;
	total?: number;
	purchased?: number;
};

type Props = {
	list: ListWithProgress;
	onManage?: (id: string, title: string) => void;
	showOwner?: boolean;
	hideManageButton?: boolean;
};

export default function ListCard({ list: l, onManage, showOwner = false, hideManageButton = false }: Props) {
	const purchased = l.purchased ?? 0;
	const total = l.total ?? 0;
	const pct = ((purchased / Math.max(total, 1)) * 100).toFixed(1);

	return (
		<GlareCard containerClassName="h-64 sm:h-72 lg:h-80">
			<div className="relative flex flex-col justify-between h-full w-full p-4">
				{/* Title + manage */}
				<div className="flex flex-col items-center">
					<h2 className="text-3xl font-semibold text-white wrap-break-word">
						{l.title}
					</h2>
					{showOwner && l.owner_display_name && (
						<p className="mt-1 text-sm text-white/70">By {l.owner_display_name}</p>
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
					className="w-full h-2 bg-white/10 rounded-full overflow-hidden"
				>
					<div
						className="h-full bg-red-600 transition-all duration-300"
						style={{ width: `${pct}%` }}
					/>
				</div>

				{/* CTA */}
				<div className="mt-auto">
					<Link
						href={`/lists/${l.id}`}
						aria-label={`View list ${l.title}`}
						className="block w-full text-center px-3 py-2 rounded-lg bg-red-600 hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black text-sm font-medium"
					>
						View List
					</Link>
				</div>
			</div>
		</GlareCard>
	);
}
