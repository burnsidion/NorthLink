"use client";

import type { ReactNode } from "react";
import AppDockGate from "@/components/nav/app-dock-gate";
import ProfileGate from "@/components/auth/profile-gate";

export default function AuthedLayout({ children }: { children: ReactNode }) {
	return (
		<ProfileGate>
			<div>{children}<AppDockGate /></div>
		</ProfileGate>
	);
}
