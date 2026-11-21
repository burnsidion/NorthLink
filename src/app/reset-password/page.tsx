"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getProfileUser } from "@/lib/auth-helpers";
import { CyberSantaBrand } from "@/components/brand/cybersanta-brand";

export default function ResetPasswordPage() {
	const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "saved">("checking");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const submitting = useRef(false);
	const mounted = useRef(false);
	const resetUrl = useRef<string | null>(null);
	useEffect(() => {
		let active = true;
		mounted.current = true;
		resetUrl.current ??= window.location.href;
		(async () => {
			try {
				if (new URL(resetUrl.current!).searchParams.has("error")) throw new Error("Invalid link");
				const { error } = await supabase.auth.initialize();
				if (error || !await getProfileUser()) throw new Error("Missing session");
				if (active) setStatus("ready");
			} catch { if (active) setStatus("invalid"); }
			finally { if (active) window.history.replaceState(window.history.state, "", "/reset-password"); }
		})();
		return () => { active = false; mounted.current = false; };
	}, []);

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting.current || status !== "ready") return;
		setError("");
		if (password.length < 6) { setError("Use at least 6 characters."); return; }
		if (password !== confirm) { setError("The passwords don’t match. Please enter them again."); return; }
		submitting.current = true;
		setSaving(true);
		try {
			const { data, error } = await supabase.auth.updateUser({ password });
			if (error || !data.user) {
				if (error?.status === 401 || error?.status === 403 || error?.name === "AuthSessionMissingError") {
					if (mounted.current) setStatus("invalid");
					return;
				}
				throw new Error("Could not update password");
			}
			if (mounted.current) { setPassword(""); setConfirm(""); setStatus("saved"); }
		} catch {
			if (mounted.current) setError("We couldn’t save that password. Try a different password, or request a fresh reset link if this one has expired.");
		} finally {
			submitting.current = false;
			if (mounted.current) setSaving(false);
		}
	}

	return <main className="ledger-frame ledger-theme ledger-auth-shell">
		<div className="ledger-paper ledger-auth-card">
			<CyberSantaBrand />
			<h1>Reset your password</h1>
			{status === "checking" && <p role="status">Checking your reset link…</p>}
			{status === "invalid" && <>
				<p role="alert">This reset link has expired or couldn’t be verified. Return to sign in and choose “Forgot your password?” to request a new one.</p>
				<Link href="/login?reset=1" className="ledger-button">Return to sign in</Link>
			</>}
			{status === "saved" && <>
				<p role="status">Your password has been updated.</p>
				<button className="ledger-button" onClick={() => window.location.replace("/")}>Continue to CyberSanta</button>
			</>}
			{status === "ready" && <form className="ledger-reset-form" onSubmit={save}>
				<p>Enter and confirm your new password.</p>
				<label>New password<input className="ledger-input" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} disabled={saving} /></label>
				<label>Confirm new password<input className="ledger-input" type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={event => setConfirm(event.target.value)} disabled={saving} /></label>
				{error && <><p role="alert">{error}</p><Link href="/login?reset=1">Request a new reset link</Link></>}
				<div className="ledger-dialog-actions"><button className="ledger-button" type="submit" disabled={saving}>{saving ? "Saving password…" : "Save new password"}</button></div>
			</form>}
		</div>
	</main>;
}
