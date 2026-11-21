import { supabase } from "@/lib/supabase";
import { getProfileAccess, getProfileUser } from "@/lib/auth-helpers";

export function isPasswordRecoveryUrl(value: string | null): boolean {
	if (!value) return false;
	const url = new URL(value);
	return url.searchParams.get("type") === "recovery" || new URLSearchParams(url.hash.slice(1)).get("type") === "recovery";
}

/** Accept only existing signed-in destinations. Drop query strings and fragments. */
export function safeAuthDestination(value: string | null): string {
	if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\s]/.test(value)) return "/landing";
	const path = value.split(/[?#]/, 1)[0];
	if (["/landing", "/user-lists", "/family-lists", "/purchased-items"].includes(path)) return path;
	if (/^\/lists\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)) return path;
	return "/landing";
}

export async function finishAuthCallback(callbackUrl: string): Promise<string> {
	const url = new URL(callbackUrl);
	const fragment = new URLSearchParams(url.hash.slice(1));
	// initialize() waits for the SDK to consume and persist the email-link session.
	// Do not move these tokens through a server route or manually copy them.
	const { error } = await supabase.auth.initialize();
	if (error) throw error;
	if (["error", "error_code", "error_description"].some(key => url.searchParams.has(key) || fragment.has(key))) {
		throw new Error("Sign-in link rejected");
	}
	// This app issues implicit-flow links, not server/code-exchange links.
	// Never mistake an unusable code link for a successful sign-in via an old session.
	if (url.searchParams.has("code")) throw new Error("Unsupported sign-in link");
	if (isPasswordRecoveryUrl(callbackUrl)) {
		if (!fragment.get("access_token") || !fragment.get("refresh_token")) throw new Error("Incomplete recovery link");
		if (!await getProfileUser()) throw new Error("No recovery session");
		return "/reset-password";
	}
	const access = await getProfileAccess();
	if (access === "signed-out") throw new Error("No sign-in session");
	return access === "incomplete" ? "/onboarding" : safeAuthDestination(url.searchParams.get("next"));
}

let logoutRequest: Promise<void> | null = null;

/** Share concurrent attempts, including React's development effect replay. */
export function signOutBrowser(): Promise<void> {
	if (!logoutRequest) {
		logoutRequest = (async () => {
			// Preserve the app's existing all-device sign-out behavior.
			const { error } = await supabase.auth.signOut({ scope: "global" });
			if (error) throw error;
		})().finally(() => { logoutRequest = null; });
	}
	return logoutRequest;
}
