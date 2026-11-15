"use client";
//Deps
import { useEffect, useRef, useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";
import { getProfileUser } from "@/lib/auth-helpers";
import { motion } from "motion/react";

//UI components
import { StarsBackground } from "@/components/ui/stars-background";
import Snowfall from "@/components/ui/snowfall";
import { BorderBeam } from "@/components/ui/border-beam";

export default function LoginPage() {
	const sb = supabase;

	const generation = useRef(0);
	const [attempt, setAttempt] = useState(0);
	const [failedAttempt, setFailedAttempt] = useState<number | null>(null);

	useEffect(() => {
		const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
			if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED"].includes(event)) {
				generation.current++;
				setAttempt(value => value + 1);
			}
		});
		return () => subscription.unsubscribe();
	}, [sb]);

	useEffect(() => {
		let active = true;
		const request = ++generation.current;
		// Validate stored sessions before redirecting. An expired/revoked session
		// must leave the sign-in form available rather than bouncing to the gate.
		getProfileUser().then(user => {
			if (active && generation.current === request && user) window.location.replace("/");
		}).catch(() => {
			if (active && generation.current === request) setFailedAttempt(attempt);
		});
		return () => { active = false; };
	}, [attempt]);

	return (
		<main className="relative min-h-dvh grid place-items-center p-6">
			{/* backgrounds behind everything */}
			<div className="pointer-events-none fixed inset-0 -z-10">
				<StarsBackground />
				<Snowfall
					count={70}
					speed={40}
					wind={0.18}
					enableMeteors={true}
					meteorCount={3}
				/>
			</div>

			{/* Auth Card */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className="relative w-full max-w-md rounded-lg border border-white/10 bg-black/40 backdrop-blur-sm p-6 sm:p-8 shadow-2xl"
			>
				<BorderBeam size={250} duration={12} delay={9} />

				<h1 className="heading-festive mb-6 text-xl font-semibold text-center text-white">
					🎁 🎄 Sign in to CyberSanta 🎄 🎁
				</h1>
				{failedAttempt === attempt && (
					<div className="mb-4 space-y-2">
						<p role="alert">We couldn’t check your sign-in. Please try again.</p>
						<button onClick={() => setAttempt(value => value + 1)} className="underline">Try again</button>
					</div>
				)}
				<Auth
					supabaseClient={sb}
					appearance={{
						theme: ThemeSupa,
						variables: {
							default: {
								colors: {
									brand: "oklch(0.60 0.118 184.704)",
									inputText: "var(--foreground)",
									inputLabelText: "var(--muted-foreground)",
									inputPlaceholder: "var(--muted-foreground)",
								},
							},
						},
					}}
					providers={[]}
					view="sign_in"
					redirectTo={
						typeof window !== "undefined"
							? `${window.location.origin}/api/auth/callback`
							: undefined
					}
				/>
			</motion.div>
		</main>
	);
}
