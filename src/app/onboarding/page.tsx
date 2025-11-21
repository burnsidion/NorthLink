"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AVATARS } from "@/lib/avatars";
import { StarsBackground } from "@/components/ui/stars-background";
import Snowfall from "@/components/ui/snowfall";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
	const sb = supabase;
	const router = useRouter();
	const [displayName, setDisplayName] = useState("");
	const [avatar, setAvatar] = useState<string>("🎄");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			const {
				data: { session },
			} = await sb.auth.getSession();
			if (!session) {
				router.replace("/login");
				return;
			}

			// Prefill if profile exists
			const { data: prof } = await sb
				.from("profiles")
				.select("display_name, avatar_url")
				.eq("id", session.user.id)
				.maybeSingle();

			if (prof?.display_name) setDisplayName(prof.display_name);
			if (prof?.avatar_url) setAvatar(prof.avatar_url);
			setLoading(false);
		})();
	}, [router, sb]);

	const save = async () => {
		const {
			data: { session },
		} = await sb.auth.getSession();
		if (!session) return;

		const { error } = await sb.from("profiles").upsert(
			{
				id: session.user.id,
				display_name: displayName.trim(),
				avatar_url: avatar,
			},
			{ onConflict: "id" } // be explicit, avoids surprises
		);

		if (error) {
			console.error(error);
			// show a toast or inline error; stop the redirect
			return;
		}

		router.replace("/landing");
	};

	if (loading)
		return (
			<main className="min-h-dvh grid place-items-center p-6">Loading…</main>
		);

	return (
		<main className="min-h-dvh grid place-items-center p-6">
			<div className="pointer-events-none fixed inset-0 -z-10">
				<StarsBackground />
				<Snowfall className="absolute" count={70} speed={40} wind={0.18} />
			</div>
			<div className="w-full max-w-md space-y-4 rounded-lg border p-6 shadow-sm">
				<h1 className="heading-festive text-2xl font-semibold text-center">
					Welcome to NorthLink!
				</h1>
				<h4 className="text-center text-sm text-muted-foreground">
					Please enter your details to get started.
				</h4>

				<label className="block text-sm font-medium">Your name</label>
				<input
					className="w-full rounded border px-3 py-2 bg-black/10"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					placeholder="e.g., Ian"
				/>

				<label className="block text-sm font-medium">Choose an avatar</label>
				<div className="grid grid-cols-8 gap-2">
					{AVATARS.map((avatarUrl) => (
						<button
							key={avatarUrl}
							type="button"
							onClick={() => setAvatar(avatarUrl)}
							className={cn(
								"relative flex h-12 w-12 items-center justify-center rounded-lg border text-white transition",
								// default
								"border-white/10 bg-white/5 hover:bg-white/15",
								// selected state
								avatar === avatarUrl &&
									"bg-emerald-600/90 border-emerald-300 shadow-lg shadow-emerald-500/40"
							)}
							aria-pressed={avatar === avatarUrl}
						>
							<img src={avatarUrl} alt="Avatar option" className="h-9 w-9" />
						</button>
					))}
				</div>

				<button
					onClick={save}
					disabled={!displayName.trim()}
					className="w-full rounded bg-emerald-700 py-2 text-white disabled:opacity-50"
				>
					Save & continue
				</button>
			</div>
		</main>
	);
}
