"use client";
import { cn } from "@/lib/utils";
import { useRef } from "react";

export const GlareCard = ({
	children,
	className,
	containerClassName,
	color = "emerald",
}: {
	children: React.ReactNode;
	className?: string;
	containerClassName?: string;
	color?: "emerald" | "red";
}) => {
	const isPointerInside = useRef(false);
	const refElement = useRef<HTMLDivElement>(null);
	const state = useRef({
		glare: {
			x: 50,
			y: 50,
		},
		background: {
			x: 50,
			y: 50,
		},
		rotate: {
			x: 0,
			y: 0,
		},
	});
	const containerStyle = {
		"--m-x": "50%",
		"--m-y": "50%",
		"--r-x": "0deg",
		"--r-y": "0deg",
		"--bg-x": "50%",
		"--bg-y": "50%",
		"--duration": "300ms",
		"--foil-size": "100%",
		"--opacity": "0",
		"--radius": "48px",
		"--easing": "ease",
		"--transition": "var(--duration) var(--easing)",
	} as any;

	const backgroundStyle = {
		"--step": "5%",
		"--foil-svg": "none",
		"--pattern": "none",
		"--rainbow":
			color === "red"
				? "repeating-linear-gradient( 0deg,rgb(120,8,8) calc(var(--step) * 1),rgb(220,38,38) calc(var(--step) * 2),rgb(239,68,68) calc(var(--step) * 3),rgb(127,29,29) calc(var(--step) * 4),rgb(60,4,4) calc(var(--step) * 5),rgb(153,27,27) calc(var(--step) * 6),rgb(120,8,8) calc(var(--step) * 7) ) 0% var(--bg-y)/200% 700% no-repeat"
				: "repeating-linear-gradient( 0deg,rgb(8,120,65) calc(var(--step) * 1),rgb(34,197,94) calc(var(--step) * 2),rgb(16,185,129) calc(var(--step) * 3),rgb(6,95,70) calc(var(--step) * 4),rgb(4,60,40) calc(var(--step) * 5),rgb(16,120,80) calc(var(--step) * 6),rgb(8,120,65) calc(var(--step) * 7) ) 0% var(--bg-y)/200% 700% no-repeat",
		"--diagonal":
			color === "red"
				? "repeating-linear-gradient( 128deg,#260404 0%,hsl(0,45%,30%) 3.8%,hsl(0,45%,30%) 4.5%,hsl(0,45%,30%) 5.2%,#260404 10%,#260404 12% ) var(--bg-x) var(--bg-y)/300% no-repeat"
				: "repeating-linear-gradient( 128deg,#04260f 0%,hsl(140,45%,30%) 3.8%,hsl(140,45%,30%) 4.5%,hsl(140,45%,30%) 5.2%,#04260f 10%,#04260f 12% ) var(--bg-x) var(--bg-y)/300% no-repeat",
		"--shade":
			"radial-gradient( farthest-corner circle at var(--m-x) var(--m-y),rgba(255,255,255,0.1) 12%,rgba(255,255,255,0.15) 20%,rgba(255,255,255,0.25) 120% ) var(--bg-x) var(--bg-y)/300% no-repeat",
		backgroundBlendMode: "hue, hue, hue, overlay",
	};

	const updateStyles = () => {
		if (refElement.current) {
			const { background, rotate, glare } = state.current;
			refElement.current?.style.setProperty("--m-x", `${glare.x}%`);
			refElement.current?.style.setProperty("--m-y", `${glare.y}%`);
			refElement.current?.style.setProperty("--r-x", `${rotate.x}deg`);
			refElement.current?.style.setProperty("--r-y", `${rotate.y}deg`);
			refElement.current?.style.setProperty("--bg-x", `${background.x}%`);
			refElement.current?.style.setProperty("--bg-y", `${background.y}%`);
		}
	};
	return (
		<div
			style={containerStyle}
			className={cn(
				"relative isolate contain-[layout_style] perspective-[600px] transition-transform duration-(--duration) ease-(--easing) delay-(--delay) will-change-transform w-full aspect-17/21",
				containerClassName
			)}
			ref={refElement}
			onPointerMove={(event) => {
				const rotateFactor = 0.4;
				const rect = event.currentTarget.getBoundingClientRect();
				const position = {
					x: event.clientX - rect.left,
					y: event.clientY - rect.top,
				};
				const percentage = {
					x: (100 / rect.width) * position.x,
					y: (100 / rect.height) * position.y,
				};
				const delta = {
					x: percentage.x - 50,
					y: percentage.y - 50,
				};

				const { background, rotate, glare } = state.current;
				background.x = 50 + percentage.x / 4 - 12.5;
				background.y = 50 + percentage.y / 3 - 16.67;
				rotate.x = -(delta.x / 3.5);
				rotate.y = delta.y / 2;
				rotate.x *= rotateFactor;
				rotate.y *= rotateFactor;
				glare.x = percentage.x;
				glare.y = percentage.y;

				updateStyles();
			}}
			onPointerEnter={() => {
				isPointerInside.current = true;
				if (refElement.current) {
					setTimeout(() => {
						if (isPointerInside.current) {
							refElement.current?.style.setProperty("--duration", "0s");
						}
					}, 300);
				}
			}}
			onPointerLeave={() => {
				isPointerInside.current = false;
				if (refElement.current) {
					refElement.current.style.removeProperty("--duration");
					refElement.current?.style.setProperty("--r-x", `0deg`);
					refElement.current?.style.setProperty("--r-y", `0deg`);
				}
			}}
		>
			<div
				className={`h-full grid will-change-transform origin-center transition-transform duration-(--duration) ease-(--easing) delay-(--delay) transform-[rotateY(var(--r-x))_rotateX(var(--r-y))] rounded-(--radius) border hover:[--opacity:0.6] hover:[--duration:200ms] hover:[--easing:linear] hover:filter-none overflow-hidden ${
					color === "red" ? "border-red-800" : "border-emerald-800"
				}`}
			>
				<div className="w-full h-full grid [grid-area:1/1] mix-blend-soft-light [clip-path:inset(0_0_0_0_round_var(--radius))]">
					<div
						className={cn(
							"h-full w-full relative z-10 pointer-events-auto",
							color === "red" ? "bg-red-700" : "bg-emerald-700",
							className
						)}
					>
						{children}
					</div>
				</div>
				<div className="w-full h-full grid [grid-area:1/1] mix-blend-soft-light [clip-path:inset(0_0_1px_0_round_var(--radius))] opacity-(--opacity) transition-opacity transition-background duration-(--duration) ease-(--easing) delay-(--delay) will-change-background pointer-events-none [background:radial-gradient(farthest-corner_circle_at_var(--m-x)_var(--m-y),rgba(255,255,255,0.8)_10%,rgba(255,255,255,0.65)_20%,rgba(255,255,255,0)_90%)]" />
				<div
					className="w-full h-full grid [grid-area:1/1] mix-blend-color-dodge opacity-(--opacity) will-change-background transition-opacity [clip-path:inset(0_0_1px_0_round_var(--radius))] [background-blend-mode:hue_hue_hue_overlay] [background:var(--pattern),var(--rainbow),var(--diagonal),var(--shade)] relative pointer-events-none after:content-[''] after:grid-area-[inherit] after:bg-repeat-[inherit] after:bg-attachment-[inherit] after:bg-origin-[inherit] after:bg-clip-[inherit] after:bg-inherit after:mix-blend-exclusion after:bg-size-[var(--foil-size),200%_400%,800%,200%] after:bg-position-[center,0%_var(--bg-y),calc(var(--bg-x)*-1)_calc(var(--bg-y)*-1),var(--bg-x)_var(--bg-y)] after:[background-blend-mode:soft-light,hue,hard-light]"
					style={{ ...backgroundStyle }}
				/>
			</div>
		</div>
	);
};
