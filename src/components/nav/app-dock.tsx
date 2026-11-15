"use client";

import { FloatingDock } from "@/components/ui/floating-dock";
import { links } from "@/config/nav-links";

export default function AppDock() {
	return (
		<div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
			<FloatingDock items={links} />
		</div>
	);
}
