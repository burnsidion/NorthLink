// src/lib/list-helpers.ts
import { supabase } from "@/lib/supabase";
import type { ItemRow } from "@/types/db";

/**
 * Fetch a single list with all its items
 */
export async function getListWithItems(listId: string) {
	const [{ data: list, error: listErr }, { data: items, error: itemsErr }] =
		await Promise.all([
			supabase
				.from("lists")
				.select("id,title,created_at,owner_user_id,last_viewed_at")
				.eq("id", listId)
				.single(),
			supabase
				.from("items")
				.select(
					"id,list_id,title,purchased,purchased_at,created_at,price_cents,link,notes,most_wanted,on_sale"
				)
				.eq("list_id", listId)
				.order("created_at", { ascending: true }),
		]);

	return {
		list: listErr ? null : list,
		items: itemsErr ? [] : items ?? [],
		listError: listErr,
		itemsError: itemsErr,
	};
}

/**
 * Fetch user's family group ID
 */
export async function getUserFamilyGroup(userId: string) {
	const { data } = await supabase
		.from("group_members")
		.select("group_id")
		.eq("user_id", userId)
		.maybeSingle();

	return data?.group_id ?? null;
}

/**
 * Check if a list is shared with a specific family group
 */
export async function isListShared(listId: string, groupId: string) {
	const { data } = await supabase
		.from("list_shares")
		.select("*")
		.eq("list_id", listId)
		.eq("group_id", groupId)
		.maybeSingle();

	return !!data;
}

/**
 * Update the last_viewed_at timestamp for a list (owner only)
 */
export async function updateListLastViewed(
	listId: string,
	ownerUserId: string
) {
	const { error } = await supabase
		.from("lists")
		.update({ last_viewed_at: new Date().toISOString() })
		.eq("id", listId)
		.eq("owner_user_id", ownerUserId);

	if (error) {
		console.warn("Failed to update last_viewed_at:", error.message);
	}
}

/**
 * Calculate new purchases since last viewed
 */
export function calculateNewPurchases(
	items: ItemRow[],
	lastViewedAt: string | null
): number {
	if (!lastViewedAt || !Array.isArray(items)) return 0;

	return items.filter(
		(item) =>
			item.purchased === true &&
			item.purchased_at &&
			new Date(item.purchased_at) > new Date(lastViewedAt)
	).length;
}

/**
 * Apply filters to item list
 */
export function filterItems(
	items: ItemRow[],
	showOnSaleOnly: boolean,
	showMostWantedOnly: boolean
): ItemRow[] {
	if (!showOnSaleOnly && !showMostWantedOnly) return items;

	// If both filters active, show items matching EITHER condition (OR)
	if (showOnSaleOnly && showMostWantedOnly) {
		return items.filter(
			(item) => item.on_sale === true || item.most_wanted === true
		);
	}

	if (showOnSaleOnly) {
		return items.filter((item) => item.on_sale === true);
	}

	if (showMostWantedOnly) {
		return items.filter((item) => item.most_wanted === true);
	}

	return items;
}

/**
 * Sort items by price
 */
export function sortItemsByPrice(
	items: ItemRow[],
	direction: "asc" | "desc"
): ItemRow[] {
	return [...items].sort((a, b) => {
		const aPrice =
			a.price_cents ?? (direction === "asc" ? Infinity : -Infinity);
		const bPrice =
			b.price_cents ?? (direction === "asc" ? Infinity : -Infinity);
		return direction === "asc" ? aPrice - bPrice : bPrice - aPrice;
	});
}

/**
 * Apply sorting to items
 */
export function sortItems(
	items: ItemRow[],
	sortBy: "default" | "price-asc" | "price-desc"
): ItemRow[] {
	if (sortBy === "default") return items;
	if (sortBy === "price-asc") return sortItemsByPrice(items, "asc");
	if (sortBy === "price-desc") return sortItemsByPrice(items, "desc");
	return items;
}
