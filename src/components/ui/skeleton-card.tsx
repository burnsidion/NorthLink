"use client";

import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"relative w-full max-w-md h-96 rounded-md border border-white/10 bg-black/60",
				"overflow-hidden",
				className
			)}
		>
			{/* subtle vignette */}
			<div className="absolute inset-0 bg-[radial-gradient(1200px_400px_at_50%_-200px,rgba(255,255,255,0.06),transparent_60%)]" />
			{/* shimmer rows */}
			<div className="relative z-10 h-full p-8 flex flex-col items-center justify-center gap-5">
				<div className="h-6 w-6 rounded-full bg-white/10 animate-pulse" />
				<div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
				<div className="h-3 w-64 rounded bg-white/10 animate-pulse" />
				<div className="h-3 w-56 rounded bg-white/10 animate-pulse" />
				<div className="h-8 w-36 rounded-md bg-white/10 animate-pulse" />
			</div>
			{/* soft outer glow so it still matches your vibe */}
			<div className="pointer-events-none absolute -inset-px rounded-md ring-1 ring-white/10" />
		</div>
	);
}
