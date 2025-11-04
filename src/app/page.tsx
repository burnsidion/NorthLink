"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomeGate() {
	const router = useRouter();

	useEffect(() => {
		(async () => {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			// Not signed in -> /login
			if (!session) {
				router.replace("/login");
				return;
			}

			// Fetch profile to see if onboarding is complete
			const { data: profile, error } = await supabase
				.from("profiles")
				.select("display_name, avatar_url")
				.eq("id", session.user.id)
				.maybeSingle();

			// If no profile or missing fields -> /onboarding, else /lists
			if (error || !profile || !profile.display_name || !profile.avatar_url) {
				router.replace("/onboarding");
			} else {
				router.replace("/lists");
			}
		})();
	}, [router]);

	return null; // blank while deciding
}
