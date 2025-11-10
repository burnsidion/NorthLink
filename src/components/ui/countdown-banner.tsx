"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import ColourfulText from "./colourful-text";

type TimeLeft = { d: number; h: number; m: number; s: number };

function getTargetDate() {
	const now = new Date();
	const year = now.getFullYear();
	const target = new Date(year, 11, 25, 0, 0, 0); // Dec 25, 00:00 local
	return now > target ? new Date(year + 1, 11, 25, 0, 0, 0) : target;
}

function diff(now: Date, target: Date): TimeLeft {
	const ms = Math.max(0, target.getTime() - now.getTime());
	const d = Math.floor(ms / (24 * 60 * 60 * 1000));
	const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
	const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
	const s = Math.floor((ms % (60 * 1000)) / 1000);
	return { d, h, m, s };
}

export default function CountdownBanner({
	initialNow,
}: {
	initialNow?: number;
}) {
	const pathname = usePathname();

	// Hide on routes you don’t want the banner
	const hidden = useMemo(() => {
		return pathname === "/login" || pathname === "/signin"; // add more as needed
	}, [pathname]);

	const [target, setTarget] = useState<Date>(() => getTargetDate());
	const [left, setLeft] = useState<TimeLeft>({ d: 0, h: 0, m: 0, s: 0 });
	const raf = useRef<number | null>(null);
	const prefersReducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	useEffect(() => {
		if (hidden) return;

		setLeft(diff(new Date(), target));

		const tick = () => {
			const now = new Date();
			const d = diff(now, target);
			setLeft(d);

			// If we hit 0, roll to next year’s Christmas
			if (d.d === 0 && d.h === 0 && d.m === 0 && d.s === 0) {
				const next = getTargetDate();
				setTarget(next);
				setLeft(diff(new Date(), next));
			}

			// Update about once per second without drift
			raf.current = window.setTimeout(tick, 1000) as unknown as number;
		};

		if (prefersReducedMotion) {
			// Update every 10s to reduce work if user prefers reduced motion
			raf.current = window.setTimeout(tick, 10000) as unknown as number;
		} else {
			raf.current = window.setTimeout(tick, 1000) as unknown as number;
		}

		return () => {
			if (raf.current) clearTimeout(raf.current);
		};
	}, [hidden, target, prefersReducedMotion]);

	if (hidden) return null;

	return (
		<div
			className="sticky top-0 z-60 w-full backdrop-blur supports-backdrop-filter:bg-black/30 bg-black/60"
			role="region"
			aria-label="Countdown to Christmas"
		>
			<div className="mx-auto max-w-6xl px-4 py-2 flex flex-wrap md:flex-nowrap items-center justify-center gap-x-4 gap-y-2 text-sm text-white">
				<span className="font-bold text-xl tracking-normal md:tracking-wide shrink-0">
					{" "}
					<ColourfulText text="Christmas Countdown" /> :
				</span>
				<div className="flex items-center gap-2">
					<TimePill label="Days" value={left.d} />
					<Separator />
					<TimePill label="Hours" value={left.h} />
					<Separator />
					<TimePill label="Min" value={left.m} />
					<Separator />
					<TimePill label="Sec" value={left.s} />
				</div>
			</div>
		</div>
	);
}

function TimePill({ label, value }: { label: string; value: number }) {
	return (
		<div className="inline-flex items-baseline gap-1 rounded-full bg-white/10 px-2.5 py-1">
			<span
				suppressHydrationWarning
				className="tabular-nums text-base font-semibold"
			>
				{value}
			</span>
			<span className="text-xs text-white/80">{label}</span>
		</div>
	);
}

function Separator() {
	return <span className="text-white/40">·</span>;
}
