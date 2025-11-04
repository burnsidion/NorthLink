"use client";

import { useEffect } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
	const sb = supabase;

	useEffect(() => {
		const {
			data: { subscription },
		} = sb.auth.onAuthStateChange((evt, session) => {
			if (session && (evt === "SIGNED_IN" || evt === "TOKEN_REFRESHED")) {
				// Hard redirect so the new session is visible everywhere immediately
				window.location.replace("/");
			}
		});
		return () => subscription.unsubscribe();
	}, [sb]);

	return (
		<main className="min-h-dvh grid place-items-center p-6">
			<div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
				<h1 className="mb-4 text-2xl font-semibold text-center">
					Sign in to NorthLink
				</h1>
				<Auth
					supabaseClient={sb}
					appearance={{
						theme: ThemeSupa,
						variables: {
							default: {
								colors: {
									inputText: "#fff",
									inputLabelText: "#ccc",
									inputPlaceholderText: "#999",
								},
							},
						},
					}}
					providers={[]}
					view="sign_in"
					// optional: let GoTrue do a redirect itself
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
