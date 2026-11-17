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
			<span className="family-scroll-paper" aria-hidden="true" />
			<svg className="family-scroll-cord" viewBox="0 0 44 180" preserveAspectRatio="none" fill="none" aria-hidden="true">
				<g stroke="#6d3028" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
					<path d="M22 0C18 35 26 75 22 110S20 150 23 180M22 135C4 113 1 145 22 135C42 113 44 145 22 135M22 136L10 165M23 136L35 163" />
				</g>
				<g stroke="#fff5df" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
					<path d="M22 0C18 35 26 75 22 110S20 150 23 180M22 135C4 113 1 145 22 135C42 113 44 145 22 135M22 136L10 165M23 136L35 163" />
				</g>
				<g stroke="#b32e38" strokeWidth="4" strokeDasharray="4 6" strokeLinecap="butt" strokeLinejoin="round">
					<path d="M22 0C18 35 26 75 22 110S20 150 23 180M22 135C4 113 1 145 22 135C42 113 44 145 22 135M22 136L10 165M23 136L35 163" />
				</g>
				<ellipse cx="22" cy="135" rx="5" ry="4" fill="#28533b" stroke="#153a29" strokeWidth="1.5" />
			</svg>
			<svg className="family-scroll-top-bow" viewBox="0 0 44 44" fill="none" aria-hidden="true">
				<g stroke="#6d3028" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
					<path d="M22 16C4 -6 1 27 22 16C42 -6 44 27 22 16M22 17L10 37M23 17L35 35" />
				</g>
				<g stroke="#fff5df" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
					<path d="M22 16C4 -6 1 27 22 16C42 -6 44 27 22 16M22 17L10 37M23 17L35 35" />
				</g>
				<g stroke="#b32e38" strokeWidth="4" strokeDasharray="4 6" strokeLinejoin="round">
					<path d="M22 16C4 -6 1 27 22 16C42 -6 44 27 22 16M22 17L10 37M23 17L35 35" />
				</g>
				<ellipse cx="22" cy="16" rx="5" ry="4" fill="#28533b" stroke="#153a29" strokeWidth="1.5" />
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
