// src/lib/family-group-helpers.ts
import { supabase } from "@/lib/supabase";

export type GroupMembership = {
	group_id: string;
	group_name: string;
	role: string;
	invite_code: string | null;
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
		throw error;
	}

	if (data && data.groups) {
		const groups: unknown = data.groups;
		if (
			typeof groups !== "object" ||
			groups === null ||
			!("name" in groups) ||
			typeof groups.name !== "string" ||
			!("invite_code" in groups) ||
			(groups.invite_code !== null && typeof groups.invite_code !== "string")
		) {
			throw new Error("Could not read your family group. Please refresh and try again.");
		}
		return {
			group_id: data.group_id,
			group_name: groups.name,
			role: data.role,
			invite_code: groups.invite_code ?? null,
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
export async function joinFamilyGroup(inviteCode: string): Promise<string> {
	const code = inviteCode.trim().toUpperCase();
	if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
		throw new Error("Enter the 8-character invite code shared by your family.");
	}
	const { data, error } = await supabase.rpc("join_group_by_invite_code", {
		p_invite_code: code,
	});

	if (error) throw error;
	if (typeof data !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data)) {
		throw new Error("Could not confirm your family membership. Please refresh and try again.");
	}
	return data;
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
