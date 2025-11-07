"use client";
//Deps
import { useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

//UI components
import { StarsBackground } from "@/components/ui/stars-background";
import Snowfall from "@/components/ui/snowfall";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
	const sb = supabase;

	useEffect(() => {
		const {
			data: { subscription },
		} = sb.auth.onAuthStateChange((evt, session) => {
			if (session && (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED")) {
				window.location.replace("/");
			}
		});
		return () => subscription.unsubscribe();
	}, [sb]);

	return (
		<main className="relative min-h-dvh grid place-items-center p-6">
			{/* backgrounds behind everything */}
			<div className="pointer-events-none fixed inset-0 -z-10">
				<StarsBackground starColor="var(--stars-dim)" />
				<Snowfall
					className="absolute inset-0 z-0"
					count={70}
					speed={40}
					wind={0.18}
				/>
			</div>

			<ThemeToggle />

			<div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
				<h1 className="mb-4 text-2xl font-semibold text-center">
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
