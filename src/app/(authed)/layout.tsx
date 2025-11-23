"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppDockGate from "@/components/nav/app-dock-gate";
import { getCurrentUser } from "@/lib/auth-helpers";

export default function AuthedLayout({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [isChecking, setIsChecking] = useState(true);

	useEffect(() => {
		const checkAuth = async () => {
			const user = await getCurrentUser();

			if (!user) {
				router.replace("/login");
				return;
			}

			setIsChecking(false);
		};

		checkAuth();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (event === "SIGNED_OUT" || !session) {
				router.replace("/login");
			}
		});

		return () => subscription.unsubscribe();
	}, [router]);

	if (isChecking) {
		return null; // or a loading spinner
	}

	return (
		<div>
			{children}
			{/* Dock appears only when signed-in */}
			<AppDockGate />
		</div>
	);
}
