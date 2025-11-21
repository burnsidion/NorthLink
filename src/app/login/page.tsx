"use client";
//Deps
import { useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

//UI components
import { StarsBackground } from "@/components/ui/stars-background";
import Snowfall from "@/components/ui/snowfall";

export default function LoginPage() {
	const sb = supabase;

	useEffect(() => {
		const {
			data: { subscription },
		} = sb.auth.onAuthStateChange((evt, session) => {
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
				<Snowfall className="absolute" count={70} speed={40} wind={0.18} />
			</div>

			{/* Auth Card */}
			<div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
				<h1 className="heading-festive mb-4 text-2xl font-semibold text-center">
					🎁 🎄 Sign in to NorthLink 🎄 🎁
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
									inputPlaceholderText: "var(--muted-foreground)",
								},
							},
						},
					}}
					providers={[]}
					view="sign_in"
					redirectTo={
						typeof window !== "undefined"
							? `${window.location.origin}/`
							: undefined
					}
				/>
			</div>
		</main>
	);
}
