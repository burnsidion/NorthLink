"use client";
//Deps
import { useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";
import { motion } from "motion/react";

//UI components
import { StarsBackground } from "@/components/ui/stars-background";
import Snowfall from "@/components/ui/snowfall";
import { BorderBeam } from "@/components/ui/border-beam";

export default function LoginPage() {
	const sb = supabase;

	useEffect(() => {
		const {
			data: { subscription },
		} = sb.auth.onAuthStateChange((evt, session) => {
			if (evt === "SIGNED_OUT") {
				// Stay on login page when signed out
				return;
			}
			if (session && (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED")) {
				window.location.replace("/landing");
			}
		});
		return () => subscription.unsubscribe();
	}, [sb]);

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
