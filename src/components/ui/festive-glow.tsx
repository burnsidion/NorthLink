// src/components/ui/festive-glow.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.PropsWithChildren<{
	className?: string;
	from?: string; // tailwind class for start color
	to?: string; // tailwind class for end color
	pulse?: boolean;
}>;

export function FestiveGlow({
	children,
	className,
	from = "from-red-600/20",
	to = "to-emerald-600/20",
	pulse = true,
}: Props) {
	return (
		<div className={cn("relative rounded-2xl", className)}>
			{/* always-on soft glow */}
			<div
				className={cn(
					"pointer-events-none absolute -inset-1 rounded-2xl bg-linear-to-r blur-xl",
					from,
					to,
					pulse ? "animate-pulse animation-duration-[2.5s]" : ""
				)}
			/>
			{/* content */}
			<div className="relative">{children}</div>
		</div>
	);
}
