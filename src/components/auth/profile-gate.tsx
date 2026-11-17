"use client";

import { WreathLoader } from "@/components/ui/wreath-loader";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getProfileAccess } from "@/lib/auth-helpers";

// This controls navigation only. Database policies still enforce data access.
export default function ProfileGate({ children, redirectReadyTo }: {
	children?: ReactNode;
	redirectReadyTo?: string;
}) {
	const router = useRouter();
	const generation = useRef(0);
	const [attempt, setAttempt] = useState(0);
	const [result, setResult] = useState<{ attempt: number; status: "ready" | "error" } | null>(null);

	const retry = () => {
		generation.current++;
		setAttempt(value => value + 1);
	};

	useEffect(() => {
		const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
			// Schedule checks outside the auth callback; Supabase holds its auth lock here.
			if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) {
				generation.current++;
				setAttempt(value => value + 1);
			}
		});
		return () => subscription.unsubscribe();
	}, []);

	useEffect(() => {
		const request = ++generation.current;
		const invalidate = () => { generation.current++; };
		(async () => {
			try {
				const access = await getProfileAccess();
				if (generation.current !== request) return;
				if (access === "signed-out") router.replace("/login");
				else if (access === "incomplete") router.replace("/onboarding");
				else if (redirectReadyTo) router.replace(redirectReadyTo);
				else setResult({ attempt, status: "ready" });
			} catch {
				if (generation.current === request) setResult({ attempt, status: "error" });
			}
		})();
		return invalidate;
	}, [attempt, redirectReadyTo, router]);

	if (result?.attempt === attempt && result.status === "ready") return children;
	return (
		<main className="ledger-frame ledger-theme ledger-auth-shell">
			{result?.attempt === attempt && result.status === "error" ? (
				<div className="space-y-4 text-center">
					<p role="alert">We couldn’t check your profile. Please try again.</p>
					<button onClick={retry} className="rounded bg-emerald-700 px-4 py-2 text-white">Try again</button>
				</div>
			) : <div className="ledger-paper ledger-auth-card"><WreathLoader label="Checking your profile…" /></div>}
		</main>
	);
}
