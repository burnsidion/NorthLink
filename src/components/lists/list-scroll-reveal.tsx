"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const duration = 620;

/** Visual entrance only: children keep their size and their existing data lifecycle. */
export default function ListScrollReveal({ children, onComplete }: {
	children: ReactNode;
	onComplete?: () => void;
}) {
	const paper = useRef<HTMLDivElement>(null);
	const roller = useRef<HTMLDivElement>(null);
	const complete = useRef(onComplete);
	const [opened, setOpened] = useState(false);

	useEffect(() => { complete.current = onComplete; }, [onComplete]);
	useEffect(() => {
		let active = true;
		let finished = false;
		let fallback: ReturnType<typeof setTimeout> | undefined;
		const animations: Animation[] = [];
		let observer: ResizeObserver | undefined;
		const sheet = paper.current;
		const roll = roller.current;
		const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
		const finish = () => {
			if (!active || finished) return;
			finished = true;
			clearTimeout(fallback);
			// Remove clipping before releasing controls, including if an animation failed.
			if (sheet) sheet.style.clipPath = "none";
			if (roll) roll.style.visibility = "hidden";
			animations.forEach(animation => animation.cancel());
			observer?.disconnect();
			window.removeEventListener("resize", finish);
			preference?.removeEventListener("change", onPreference);
			document.removeEventListener("visibilitychange", onVisibility);
			setOpened(true);
			complete.current?.();
		};
		const onPreference = () => { if (preference?.matches) finish(); };
		const onVisibility = () => { if (document.hidden) finish(); };
		window.addEventListener("resize", finish);
		preference?.addEventListener("change", onPreference);
		document.addEventListener("visibilitychange", onVisibility);

		if (!sheet || !roll || !preference || preference.matches || !sheet.animate || !roll.animate) {
			// CSS already shows the open paper for reduced motion; release inert immediately.
			void Promise.resolve().then(finish);
		} else {
			const { height, top } = sheet.getBoundingClientRect();
			// A long list unrolls past the visible screen, rather than racing its full length.
			const end = Math.min(height, Math.max(128, window.innerHeight - top + 48));
			const timing: KeyframeAnimationOptions = { duration, easing: "cubic-bezier(.22,.7,.2,1)", fill: "forwards" };
			try {
				animations.push(sheet.animate([
					{ clipPath: `inset(0px 0px ${Math.max(0, height - 28)}px 0px)` },
					{ clipPath: `inset(0px 0px ${Math.max(0, height - end)}px 0px)` },
				], timing));
				animations.push(roll.animate([
					{ transform: "translateY(28px)" },
					{ transform: `translateY(${end}px)` },
				], timing));
				void Promise.all(animations.map(animation => animation.finished)).then(finish, finish);
				if (typeof ResizeObserver !== "undefined") {
					observer = new ResizeObserver(() => {
						if (!finished && Math.abs(sheet.getBoundingClientRect().height - height) > 2) finish();
					});
					observer.observe(sheet);
				}
			} catch {
				animations.forEach(animation => { void animation.finished.catch(() => {}); });
				void Promise.resolve().then(finish);
			}
			// Never leave the list locked if a browser fails to report completion.
			fallback = setTimeout(finish, duration + 350);
		}
		return () => {
			active = false;
			clearTimeout(fallback);
			observer?.disconnect();
			window.removeEventListener("resize", finish);
			preference?.removeEventListener("change", onPreference);
			document.removeEventListener("visibilitychange", onVisibility);
			animations.forEach(animation => animation.cancel());
		};
	}, []);

	return (
		<div className="list-scroll-shell ledger-theme" data-open={opened} aria-busy={!opened}>
			{!opened && <span className="sr-only" role="status">Unrolling your list…</span>}
			<div className="list-scroll-roller list-scroll-top" aria-hidden="true" />
			<div ref={paper} className="list-scroll-paper" inert={!opened} aria-hidden={!opened}>
				{children}
			</div>
			<div ref={roller} className="list-scroll-roller list-scroll-travelling" aria-hidden="true" />
			<div className="list-scroll-roller list-scroll-bottom" aria-hidden="true" />
		</div>
	);
}
