"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { finishAuthCallback } from "@/lib/auth-flow";

export default function AuthCallbackPage() {
	const router = useRouter();
	const callbackUrl = useRef<string | null>(null);
	const [attempt, setAttempt] = useState(0);
	const [failedAttempt, setFailedAttempt] = useState<number | null>(null);

	useEffect(() => {
		let active = true;
		callbackUrl.current ??= window.location.href;
		(async () => {
			let destination: string | undefined;
			try {
				destination = await finishAuthCallback(callbackUrl.current!);
			} catch {
				if (active) setFailedAttempt(attempt);
			} finally {
				// Clear callback parameters from the address bar before navigating.
				// Provider error details must not be displayed or forwarded.
				if (active) window.history.replaceState(window.history.state, "", "/api/auth/callback");
			}
			if (active && destination) router.replace(destination);
		})();
		return () => { active = false; };
	}, [attempt, router]);

	return (
		<main className="min-h-dvh grid place-items-center p-6">
			{failedAttempt === attempt ? (
				<div className="max-w-md space-y-4 text-center">
					<p role="alert">We couldn’t finish signing you in. Try again, or return to sign in and request a fresh confirmation link.</p>
					<button onClick={() => setAttempt(value => value + 1)} className="rounded bg-emerald-700 px-4 py-2 text-white">Try again</button>
					<Link className="block underline" href="/login">Return to sign in</Link>
				</div>
			) : <p role="status">Finishing sign-in…</p>}
		</main>
	);
}
