import type { ReactNode } from "react";
import AppDockGate from "@/components/nav/app-dock-gate";

export default function AuthedLayout({ children }: { children: ReactNode }) {
	return (
		<div>
			{children}
			{/* Dock appears only when signed-in */}
			<AppDockGate />
		</div>
	);
}
