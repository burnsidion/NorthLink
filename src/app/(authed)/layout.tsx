"use client";

import type { ReactNode } from "react";
import LedgerFrame from "@/components/nav/ledger-frame";
import ProfileGate from "@/components/auth/profile-gate";

export default function AuthedLayout({ children }: { children: ReactNode }) {
	return (
		<ProfileGate>
			<LedgerFrame>{children}</LedgerFrame>
		</ProfileGate>
	);
}
