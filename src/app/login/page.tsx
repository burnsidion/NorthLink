"use client";

import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
	const sb = supabase();

	return (
		<main className="min-h-dvh grid place-items-center p-6">
			<div className="w-full max-w-md rounded-lg border p-6 shadow-sm">
				<h1 className="mb-4 text-2xl font-semibold text-center">
					Sign in to NorthLink
				</h1>

				{/* Drop-in auth form from Supabase */}
				<Auth
					supabaseClient={sb}
					appearance={{
						theme: ThemeSupa,
						variables: {
							default: {
								colors: {
									inputText: "#ffffff",
									inputLabelText: "#cccccc",
									inputPlaceholderText: "#999999",
								},
							},
						},
					}}
					providers={[]} // no OAuth for MVP
					view="sign_in"
					localization={{
						variables: {
							sign_in: { email_label: "Email", password_label: "Password" },
						},
					}}
				/>

				<p className="mt-4 text-center text-sm text-gray-500">
					Don’t have an account? Use the “Sign up” tab in the form.
				</p>
			</div>
		</main>
	);
}
