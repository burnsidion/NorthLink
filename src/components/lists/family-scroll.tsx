import Link from "next/link";
import { ProfileAvatar } from "@/components/brand/profile-avatar";
import type { ListWithProgress } from "./list-card";

/** A closed scroll is one destination, rather than another disclosure step. */
export default function FamilyScroll({ list }: { list: ListWithProgress }) {
	const owner = list.owner_display_name?.trim() || "Family member";
	const purchased = list.purchased ?? 0;
	const total = list.total ?? 0;
	const percent = Math.min(100, Math.max(0, purchased / Math.max(1, total) * 100));
	return (
		<Link href={`/lists/${list.id}`} className="ledger-theme family-scroll"
			aria-label={`Open ${list.title} by ${owner}`}>
			<span className="family-scroll-edge" aria-hidden="true" />
			<svg className="family-scroll-cord" viewBox="0 0 44 180" preserveAspectRatio="none" fill="none" aria-hidden="true">
				<path d="M22 0C14 35 27 68 20 100S26 150 21 180" stroke="#61452e" strokeWidth="3" />
				<path d="M25 0C18 36 30 69 23 100S29 151 24 180" stroke="#b38b59" strokeWidth="1.5" />
				<g stroke="#785235" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M22 105C-1 82 1 119 22 105C45 82 45 119 22 105Z" fill="#dcc49b" />
					<path d="M22 105C17 120 8 128 7 140M23 105C29 116 34 122 36 134" />
				</g>
				<ellipse cx="22" cy="105" rx="4" ry="3" fill="#795637" />
			</svg>
			<ProfileAvatar src={list.owner_avatar_url} name={owner} size={40} />
			<div className="family-scroll-label">
				<h2>{list.title}</h2>
				<p className="family-scroll-owner">By {owner}</p>
				<p className="family-scroll-count">{purchased} of {total} gifts purchased</p>
				<div className="scroll-progress family-scroll-progress" role="progressbar"
					aria-label={`Purchase progress for ${list.title}`} aria-valuemin={0}
					aria-valuemax={Math.max(1, total)} aria-valuenow={Math.min(purchased, Math.max(1, total))}
					aria-valuetext={`${purchased} of ${total} gifts purchased`}>
					<div style={{ width: `${percent}%` }} />
				</div>
				<span className="family-scroll-open" aria-hidden="true">Open list <span>→</span></span>
			</div>
		</Link>
	);
}
