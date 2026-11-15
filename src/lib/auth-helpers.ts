// src/lib/auth-helpers.ts
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Get the current authenticated user session.
 * Returns null if no session exists.
 */
export async function getCurrentSession() {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	return session;
}

/**
 * Get the current authenticated user.
 * Returns null if no user is authenticated.
 */
export async function getCurrentUser() {
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
}

/**
 * Check if user is authenticated and redirect to login if not.
 * Returns the user if authenticated, null otherwise.
 */
export async function requireAuth(redirectFn?: (path: string) => void) {
	const user = await getCurrentUser();
	if (!user && redirectFn) {
		redirectFn("/login");
	}
	return user;
}

/**
 * Fetch user profile by ID
 */
export async function getUserProfile(userId: string) {
	const { data, error } = await supabase
		.from("profiles")
		.select("display_name, avatar_url")
		.eq("id", userId)
		.maybeSingle();

	if (error) throw error;

	return data;
}

/**
 * Check if user profile is complete (has display_name and avatar_url)
 */
export function isProfileComplete(
	profile: {
		display_name?: string | null;
		avatar_url?: string | null;
	} | null
): boolean {
	return !!(profile?.display_name?.trim() && profile?.avatar_url?.trim());
}

/** Distinguish a signed-out visitor from a request that failed. */
export async function getProfileUser() {
	const { data: { user }, error } = await supabase.auth.getUser();
	if (error && !isAuthSessionMissingError(error)) throw error;
	return user;
}

export async function getProfileAccess() {
	const user = await getProfileUser();
	if (!user) return "signed-out" as const;
	const profile = await getUserProfile(user.id);
	return isProfileComplete(profile) ? "ready" as const : "incomplete" as const;
}

export async function saveSetupProfile(userId: string, name: string, avatar: string) {
	const user = await getProfileUser();
	if (!user || user.id !== userId) throw new Error("Account changed");
	if (!name.trim() || !avatar.trim()) throw new Error("Profile incomplete");
	const { data, error } = await supabase.from("profiles").upsert({
		id: user.id, display_name: name.trim(), avatar_url: avatar,
	}, { onConflict: "id" }).select("display_name, avatar_url").single();
	if (error) throw error;
	if (!isProfileComplete(data)) throw new Error("Profile save was not confirmed");
}
