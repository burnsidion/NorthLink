"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ListsPage() {
	const sb = supabase;
	const router = useRouter();
	const [email, setEmail] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			const {
				data: { session },
			} = await sb.auth.getSession();
			if (!session) {
				router.replace("/login");
				return;
			}
			setEmail(session.user.email ?? null);
		})();
	}, [router, sb]);

	return (
		<main className="p-8 space-y-4">
			<h1 className="text-2xl font-semibold">My Lists</h1>
			<p className="text-sm text-gray-500">Signed in as {email}</p>
			<div className="rounded border p-4">
				Lists UI goes here (owner view + create list)
			</div>
		</main>
	);
}
