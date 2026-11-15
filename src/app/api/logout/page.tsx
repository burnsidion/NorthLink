"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOutBrowser } from "@/lib/auth-flow";

export default function LogoutPage() {
	const router = useRouter();
	const [attempt, setAttempt] = useState(0);
	const [failedAttempt, setFailedAttempt] = useState<number | null>(null);

	useEffect(() => {
		let active = true;
		signOutBrowser().then(() => {
			if (active) router.replace("/login");
		}).catch(() => {
			if (active) setFailedAttempt(attempt);
		});
		return () => { active = false; };
	}, [attempt, router]);

	return (
		<main className="min-h-dvh grid place-items-center p-6">
			{failedAttempt === attempt ? (
				<div className="max-w-md space-y-4 text-center">
					<p role="alert">We couldn’t sign you out. Please try again.</p>
					<button onClick={() => setAttempt(value => value + 1)} className="rounded bg-emerald-700 px-4 py-2 text-white">Try again</button>
					<Link className="block underline" href="/">Return to the app</Link>
				</div>
			) : <p role="status">Signing you out…</p>}
		</main>
	);
}
