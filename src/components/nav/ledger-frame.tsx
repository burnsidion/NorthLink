"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { CyberSantaBrand } from "@/components/brand/cybersanta-brand";

const destinations = [
	{ href: "/user-lists", label: "My Lists" },
	{ href: "/family-lists", label: "Family Lists" },
	{ href: "/purchased-items", label: "Purchased Gifts" },
];

export default function LedgerFrame({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const menu = useRef<HTMLDetailsElement>(null);
	const closeMenu = () => { if (menu.current) menu.current.open = false; };
	const navLinks = destinations.map(({ href, label }) => (
		<Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={closeMenu}>{label}</Link>
	));
	return (
		<div className="ledger-frame">
			<a href="#page-content" className="ledger-skip">Skip to content</a>
			<header className="ledger-header ledger-theme ledger-paper">
				<div className="ledger-header-row">
					<CyberSantaBrand />
					<nav className="ledger-desktop-nav" aria-label="Primary navigation">{navLinks}</nav>
					<div className="ledger-desktop-account">
						<Link href="/onboarding">Profile</Link><Link href="/api/logout">Sign out</Link>
					</div>
				</div>
				<details className="ledger-mobile-menu" ref={menu} onKeyDown={event => {
					if (event.key === "Escape") {
						closeMenu();
						menu.current?.querySelector("summary")?.focus();
					}
				}}>
					<summary>Menu <span aria-hidden="true">☰</span></summary>
					<nav aria-label="Mobile navigation">
						{navLinks}<Link href="/landing" onClick={closeMenu}>Home</Link>
						<Link href="/onboarding" onClick={closeMenu}>Profile</Link>
						<Link href="/api/logout" onClick={closeMenu}>Sign out</Link>
					</nav>
				</details>
			</header>
			<div id="page-content" tabIndex={-1} className="ledger-content">{children}</div>
			<footer className="ledger-footer ledger-theme ledger-paper">
				<CyberSantaBrand compact />
				<span className="ledger-footer-note">Keep the surprises secret.</span>
				<Link href="/onboarding">Your profile</Link>
			</footer>
		</div>
	);
}
