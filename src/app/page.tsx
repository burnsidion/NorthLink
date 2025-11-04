"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
	const sb = supabase();
	const [email, setEmail] = useState<string | null>(null);

	useEffect(() => {
		// read current session
		sb.auth
			.getSession()
			.then(({ data }) => setEmail(data.session?.user.email ?? null));

		// respond to future auth changes
		const { data: sub } = sb.auth.onAuthStateChange(async (_evt, session) => {
			if (session?.user) {
				setEmail(session.user.email);
				// ensure the user's profile and family membership exist
				const { ensureProfileAndMembership } = await import("@/lib/user-setup");
				await ensureProfileAndMembership();
			} else {
				setEmail(null);
			}
		});

		return () => sub.subscription.unsubscribe();
	}, [sb]);

	if (!email) {
		return (
			<main className="p-8">
				<a className="underline" href="/login">
					Sign in
				</a>
			</main>
		);
	}

	return (
		<main className="p-8 space-y-4">
			<p>
				Signed in as <strong>{email}</strong>
			</p>
			<button
				className="rounded bg-black text-white px-3 py-2"
				onClick={() => sb.auth.signOut()}
			>
				Sign out
			</button>
		</main>
	);
}
