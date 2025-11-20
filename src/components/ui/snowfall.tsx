"use client";
import { useEffect, useRef } from "react";

type Props = {
	/** total flakes on screen */
	count?: number;
	/** base fall speed in px/sec */
	speed?: number;
	/** side-to-side drift factor (0–1) */
	wind?: number;
	/** min/max flake radius in px */
	size?: { min: number; max: number };
	/** flake color */
	color?: string;
	/** reduce density on small screens */
	disableOnMobile?: boolean;
};

export default function Snowfall({
	count = 80,
	speed = 40,
	wind = 0.2,
	size = { min: 1, max: 3 },
	color = "rgba(255,255,255,0.9)",
	disableOnMobile = false,
}: Props) {
	const ref = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (
			disableOnMobile &&
			typeof window !== "undefined" &&
			window.matchMedia("(max-width: 640px)").matches
		) {
			return; // skip on small screens
		}
		if (
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		) {
			return; // honor reduced motion
		}

		const canvas = ref.current!;
		const ctx = canvas.getContext("2d")!;
		const dpr = Math.max(1, window.devicePixelRatio || 1);

		let w = 0,
			h = 0;
		const resize = () => {
			w = canvas.clientWidth;
			h = canvas.clientHeight;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const rand = (min: number, max: number) =>
			Math.random() * (max - min) + min;

		type Flake = {
			x: number;
			y: number;
			r: number;
			vy: number;
			phase: number;
			sway: number;
		};
		const flakes: Flake[] = [];

		const makeFlake = (): Flake => ({
			x: rand(0, w),
			y: rand(-h, 0),
			r: rand(size.min, size.max),
			vy: rand(0.6, 1.4) * (speed / 60), // px per frame-ish
			phase: rand(0, Math.PI * 2),
			sway: rand(0.4, 1.2) * wind, // horizontal sway intensity
		});

		const seed = () => {
			flakes.length = 0;
			const density = Math.round((count * (w * h)) / (1440 * 900)); // scale a bit by area
			for (let i = 0; i < Math.max(12, density); i++) flakes.push(makeFlake());
		};

		resize();
		seed();

		const onResize = () => {
			resize();
			seed();
		};

		window.addEventListener("resize", onResize);

		const step = () => {
			ctx.clearRect(0, 0, w, h);
			ctx.fillStyle = color;

			for (let f of flakes) {
				// gentle horizontal sway
				f.phase += 0.02;
				const dx = Math.sin(f.phase) * f.sway;

				f.y += f.vy;
				f.x += dx;

				// wrap
				if (f.y - f.r > h) {
					Object.assign(f, makeFlake(), { y: -f.r });
				}
				if (f.x < -10) f.x = w + 10;
				if (f.x > w + 10) f.x = -10;

				ctx.beginPath();
				ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
				ctx.fill();
			}
			rafRef.current = requestAnimationFrame(step);
		};

		rafRef.current = requestAnimationFrame(step);

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			window.removeEventListener("resize", onResize);
		};
	}, [count, speed, wind, size.min, size.max, color, disableOnMobile]);

	return (
		<canvas
			ref={ref}
			className="pointer-events-none fixed inset-0 w-full h-full z-50"
			style={{
				width: "100%",
				height: "100%",
				background: "transparent",
				pointerEvents: "none",
			}}
			tabIndex={-1}
			role="presentation"
			aria-hidden="true"
		/>
	);
}
