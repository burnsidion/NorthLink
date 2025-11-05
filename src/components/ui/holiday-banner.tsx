"use client";

import {
	ScrollVelocityContainer,
	ScrollVelocityRow,
} from "@/components/ui/scroll-based-velocity";

export function HolidayBanner() {
	return (
		<div className="relative w-full overflow-hidden py-4 bg-linear-to-r from-red-900/40 via-neutral-900/30 to-emerald-900/40 border-b border-white/10">
			<ScrollVelocityContainer className="text-white/90 text-sm md:text-base font-medium tracking-wide">
				<ScrollVelocityRow baseVelocity={12} direction={1} className="gap-8">
					<span className="px-2">🎄 Happy Holidays</span>
					<span className="px-2">• Spread Love (and Gifts)</span>
					<span className="px-2">• Keep Surprises Secret 🎁</span>
					<span className="px-2">• Merry & Bright</span>
				</ScrollVelocityRow>
			</ScrollVelocityContainer>
		</div>
	);
}
