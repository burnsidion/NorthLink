"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AVATARS } from "@/lib/avatars";
import { CyberSantaBrand } from "@/components/brand/cybersanta-brand";
import { ProfileAvatar } from "@/components/brand/profile-avatar";
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
		<main className="ledger-frame ledger-theme ledger-auth-shell">
			{loaded?.attempt === attempt && loaded.error ? (
				<div className="ledger-paper ledger-auth-card space-y-4 text-center">
					<p role="alert">We couldn’t load your profile. Please try again before making changes.</p>
					<button onClick={() => setAttempt(value => value + 1)} className="ledger-button">Try again</button>
				</div>
			) : <p role="status" className="ledger-paper ledger-auth-card">Loading your profile…</p>}
		</main>
	);

	return (
		<main className="ledger-frame ledger-theme ledger-auth-shell">
			<div className="ledger-paper ledger-auth-card space-y-4">
				<CyberSantaBrand />
				<h1>
					Welcome to CyberSanta!
				</h1>
				<h4 className="ledger-muted">
					Please enter your details to get started.
				</h4>
				<label htmlFor="display-name" className="block text-sm font-medium">Your name</label>
				<input
					id="display-name"
					disabled={saving}
					className="ledger-input"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
					placeholder="e.g., Ian"
				/>
				<p id="avatar-label" className="block text-sm font-medium">Choose an avatar</p>
                <div className="ledger-avatar-preview"><ProfileAvatar src={avatar} name={displayName || "Your"} size={72} /><span>Your selected avatar</span></div>
				<div className="ledger-avatar-grid" role="group" aria-labelledby="avatar-label">
					{AVATARS.map((avatarUrl, index) => (
						<button
							key={avatarUrl}
							type="button"
							disabled={saving}
							onClick={() => setAvatar(avatarUrl)}
							className="ledger-avatar-option"
                            aria-label={`Avatar option ${index + 1}`}
							aria-pressed={avatar === avatarUrl}
						>
							<ProfileAvatar src={avatarUrl} name={`Option ${index + 1}`} size={40} />
						</button>
					))}
				</div>{" "}
				{saveError && <p role="alert">We couldn’t confirm your profile was saved. Your details are still here; try saving again, or reload if your account changed.</p>}
				<button
					onClick={save}
					disabled={saving || !displayName.trim()}
					className="ledger-button w-full"
				>
					{saving ? "Saving…" : "Save & continue"}
				</button>
			</div>
		</main>
	);
}
