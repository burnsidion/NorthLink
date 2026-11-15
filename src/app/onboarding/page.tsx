"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AVATARS } from "@/lib/avatars";
import { StarsBackground } from "@/components/ui/stars-background";
import Snowfall from "@/components/ui/snowfall";
import { cn } from "@/lib/utils";
import { getProfileUser, getUserProfile, saveSetupProfile } from "@/lib/auth-helpers";

export default function OnboardingPage() {
	const router = useRouter();
	const [displayName, setDisplayName] = useState("");
	const [avatar, setAvatar] = useState<string>(AVATARS[0]);
	const [attempt, setAttempt] = useState(0);
	const [loaded, setLoaded] = useState<{ attempt: number; userId?: string; error?: boolean } | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState(false);
	const busy = useRef(false);
	const generation = useRef(0);
	const account = useRef<string | null>(null);

	useEffect(() => {
		const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
			const userId = session?.user.id ?? null;
			// SIGNED_IN also fires when returning to the tab. Keep unsaved edits
			// unless the account actually changed.
			if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && userId !== account.current)) {
				account.current = userId;
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
				const user = await getProfileUser();
				if (generation.current !== request) return;
				if (!user) { router.replace("/login"); return; }
				account.current = user.id;
				const profile = await getUserProfile(user.id);
				if (generation.current !== request) return;
				setDisplayName(profile?.display_name ?? "");
				setAvatar(profile?.avatar_url?.startsWith("https://") ? profile.avatar_url : AVATARS[0]);
				setSaveError(false);
				setSaving(false);
				setLoaded({ attempt, userId: user.id });
			} catch {
				if (generation.current === request) setLoaded({ attempt, error: true });
			}
		})();
		return invalidate;
	}, [attempt, router]);

	const save = async () => {
		if (busy.current || !loaded?.userId || loaded.attempt !== attempt || !displayName.trim()) return;
		busy.current = true;
		const request = generation.current;
		setSaving(true);
		setSaveError(false);
		try {
			await saveSetupProfile(loaded.userId, displayName, avatar);
			if (generation.current === request) router.replace("/landing");
		} catch {
			if (generation.current === request) setSaveError(true);
		} finally {
			busy.current = false;
			if (generation.current === request) setSaving(false);
		}
	};

	if (loaded?.attempt !== attempt || loaded.error) return (
		<main className="min-h-dvh grid place-items-center p-6">
			{loaded?.attempt === attempt && loaded.error ? (
				<div className="space-y-4 text-center">
					<p role="alert">We couldn’t load your profile. Please try again before making changes.</p>
					<button onClick={() => setAttempt(value => value + 1)} className="rounded bg-emerald-700 px-4 py-2 text-white">Try again</button>
				</div>
			) : <p role="status">Loading your profile…</p>}
		</main>
	);

	return (
		<main className="min-h-dvh grid place-items-center p-6">
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
			<div className="w-full max-w-md space-y-4 rounded-lg border p-6 shadow-sm">
				<h1 className="heading-festive text-2xl font-semibold text-center">
					Welcome to CyberSanta!
				</h1>
				<h4 className="text-center text-sm text-muted-foreground">
					Please enter your details to get started.
				</h4>
				<label htmlFor="display-name" className="block text-sm font-medium">Your name</label>
				<input
					id="display-name"
					disabled={saving}
					className="w-full rounded border px-3 py-2 bg-black/10"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					placeholder="e.g., Ian"
				/>
				<label className="block text-sm font-medium">Choose an avatar</label>
				<div className="grid grid-cols-6 gap-4 max-h-[400px] overflow-y-auto">
					{AVATARS.map((avatarUrl) => (
						<button
							key={avatarUrl}
							type="button"
							disabled={saving}
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
							<img
								src={avatarUrl}
								alt="Avatar option"
								className="h-9 w-9 object-cover"
								loading="lazy"
								decoding="async"
							/>
						</button>
					))}
				</div>{" "}
				{saveError && <p role="alert">We couldn’t confirm your profile was saved. Your details are still here; try saving again, or reload if your account changed.</p>}
				<button
					onClick={save}
					disabled={saving || !displayName.trim()}
					className="w-full rounded bg-emerald-700 py-2 text-white disabled:opacity-50"
				>
					{saving ? "Saving…" : "Save & continue"}
				</button>
			</div>
		</main>
	);
}
