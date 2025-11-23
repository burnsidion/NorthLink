// src/lib/family-group-helpers.ts
import { supabase } from "@/lib/supabase";

export type GroupMembership = {
	group_id: string;
	group_name: string;
	role: string;
};

/**
 * Fetch user's family group membership
 */
export async function getUserGroupMembership(
	userId: string
): Promise<GroupMembership | null> {
	const { data, error } = await supabase
		.from("group_members")
		.select("group_id, role, groups(name, invite_code)")
		.eq("user_id", userId)
		.limit(1)
		.maybeSingle();

	if (error) {
		console.error("Error fetching group membership:", error);
		return null;
	}

	if (data && data.groups) {
		// Supabase returns groups as a single object, not an array
		const groups = data.groups as unknown as {
			name: string;
			invite_code: string;
		};
		return {
			group_id: data.group_id,
			group_name: groups.name,
			role: data.role,
		};
	}

	return null;
}

/**
 * Create a new family group with invite code
 */
export async function createFamilyGroup(name: string) {
	const { data: newGroup, error } = await supabase.rpc(
		"create_group_with_code",
		{ p_name: name }
	);

	if (error) throw error;
	return newGroup;
}

/**
 * Join a family group using invite code
 */
export async function joinFamilyGroup(inviteCode: string, userId: string) {
	const { error } = await supabase.from("group_members").insert({
		group_id: inviteCode,
		user_id: userId,
		role: "member",
	});

	if (error) throw error;
}

/**
 * Copy invite code to clipboard
 */
export async function copyInviteCode(code: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(code);
		return true;
	} catch (err) {
		console.error("Failed to copy invite code:", err);
		return false;
	}
}
