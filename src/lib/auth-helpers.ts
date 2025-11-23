// src/lib/auth-helpers.ts
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

	if (error) {
		console.error("Error fetching profile:", error);
		return null;
	}

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
	return !!(profile?.display_name && profile?.avatar_url);
}
