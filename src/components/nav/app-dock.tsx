"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FloatingDock } from "@/components/ui/floating-dock";
import { links } from "@/config/nav-links";

export default function AppDock() {
	const router = useRouter();

	const handleItemClick = async (href: string) => {
		if (href === "/api/logout") {
			// Handle logout on client side
			await supabase.auth.signOut();
			router.replace("/login");
			return false; // Prevent default navigation
		}
		return true; // Allow normal navigation
	};

	return (
		<div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
			<FloatingDock items={links} onItemClick={handleItemClick} />
		</div>
	);
}
