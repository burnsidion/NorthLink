"use client";

import Link from "next/link";
import { useId, useState } from "react";

export type ListWithProgress = {
	id: string;
	title: string;
	owner_user_id?: string;
	owner_display_name?: string;
	owner_avatar_url?: string;
	created_at: string;
	total?: number;
	purchased?: number;
	group_id?: string;
};

type Props = {
	list: ListWithProgress;
	onManage?: (id: string, title: string) => void;
	onUnshare?: (listId: string, groupId: string) => void;
	currentUserId?: string;
	showOwner?: boolean;
	hideManageButton?: boolean;
	index?: number;
};

export default function ListCard({ list, onManage, onUnshare, currentUserId,
	showOwner = false, hideManageButton = false }: Props) {
	const [expanded, setExpanded] = useState(false);
	const detailsId = useId();
	const purchased = list.purchased ?? 0;
	const total = list.total ?? 0;
	const percent = Math.min(100, Math.max(0, purchased / Math.max(1, total) * 100));
	return (
		<article className="ledger-theme ledger-paper scroll-card" data-expanded={expanded}>
			<div className="scroll-summary">
				<div className="scroll-heading">
					<h2>{list.title}</h2>
					{showOwner && list.owner_display_name && <div className="scroll-owner">
						{list.owner_avatar_url && <img src={list.owner_avatar_url} width={28} height={28} alt="" />}
						<span>By {list.owner_display_name}</span>
					</div>}
					<p className="scroll-count">{purchased} of {total} purchased</p>
					<div role="progressbar" aria-label={`Purchase progress for ${list.title}`} aria-valuemin={0}
						aria-valuemax={Math.max(1, total)} aria-valuenow={purchased} aria-valuetext={`${purchased} of ${total} purchased`} className="scroll-progress">
						<div style={{ width: `${percent}%` }} />
					</div>
				</div>
				<div className="scroll-actions">
					<Link href={`/lists/${list.id}`} aria-label={`View list ${list.title}`} className="ledger-button">View list <span aria-hidden="true">→</span></Link>
					<button type="button" className="scroll-toggle" aria-expanded={expanded} aria-controls={detailsId}
						aria-label={`${expanded ? "Collapse" : "Expand"} details for ${list.title}`} onClick={() => setExpanded(value => !value)}>
						{expanded ? "Roll up" : "Unroll"}<span aria-hidden="true">⌄</span>
					</button>
				</div>
			</div>
			<div id={detailsId} className="scroll-details" aria-hidden={!expanded} inert={!expanded}>
				<div className="scroll-details-clip"><div className="scroll-details-content">
					<p>Created <time dateTime={list.created_at}>{new Date(list.created_at).toLocaleDateString()}</time> · {total} {total === 1 ? "gift" : "gifts"}</p>
					<div className="scroll-management">
						{!hideManageButton && onManage && <button type="button" className="ledger-secondary" onClick={() => onManage(list.id, list.title)} aria-label={`Manage list ${list.title}`}>Manage list</button>}
						{onUnshare && list.group_id && currentUserId === list.owner_user_id && <button type="button" className="ledger-secondary" onClick={() => onUnshare(list.id, list.group_id!)}>Unshare from family</button>}
					</div>
				</div></div>
			</div>
		</article>
	);
}
