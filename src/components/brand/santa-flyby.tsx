"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const destinations = new Set(["/landing", "/user-lists", "/family-lists"]);

export function SantaSleighFlight() {
	const sleigh = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const sprite = sleigh.current;
		if (!sprite || !window.matchMedia || !sprite.animate) return;
		const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
		let timer: ReturnType<typeof setTimeout> | undefined;
		let flight: Animation | undefined;
		const stop = () => {
			clearTimeout(timer);
			flight?.cancel();
			flight = undefined;
		};
		const schedule = (delay: number) => {
			if (document.hidden || motion.matches) return;
			timer = setTimeout(() => {
				flight = sprite.animate([
					{ transform: "translateX(-100%)", opacity: 0 },
					{ opacity: .65, offset: .08 },
					{ opacity: .65, offset: .92 },
					{ transform: "translateX(100vw)", opacity: 0 },
				], { duration: 12000, easing: "linear" });
				timer = setTimeout(() => {
					flight?.cancel();
					flight = undefined;
					schedule(60000 + Math.random() * 30000);
				}, 12000);
			}, delay);
		};
		const restart = () => { stop(); schedule(15000); };
		restart();
		document.addEventListener("visibilitychange", restart);
		motion.addEventListener("change", restart);
		return () => {
			stop();
			document.removeEventListener("visibilitychange", restart);
			motion.removeEventListener("change", restart);
		};
	}, []);
	return <div className="ledger-sleigh-sky" aria-hidden="true"><div ref={sleigh} className="ledger-sleigh" /></div>;
}

export function SantaFlyby() {
	const pathname = usePathname();
	return destinations.has(pathname) ? <SantaSleighFlight key={pathname} /> : null;
}
