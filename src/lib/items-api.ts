// src/lib/items-api.ts
import { supabase } from "@/lib/supabase";
import { toCents, normalizeUrl, validatePriceCents } from "@/lib/format";
import { validateItemImage } from "@/lib/item-image";
import type { ItemRow } from "@/types/db";

/** Create a new item on a list. Returns the inserted row. */
export async function addItem(
	listId: string,
	input: {
		title: string;
		price?: string; // "24.99" (optional)
		link?: string; // raw url (optional)
		notes?: string; // optional
		imageUrl?: string | null;
	}
): Promise<ItemRow> {
	const { title, price, link, notes } = input;
	// Omit absent images so manual entry also works before the thumbnail migration.
	const imageUrl = validateItemImage(input.imageUrl);
	const image = imageUrl ? { image_url: imageUrl } : {};

	const { data, error } = await supabase
		.from("items")
		.insert({
			...image,
			list_id: listId,
			title: title.trim(),
			price_cents: toCents(price ?? ""),
			link: normalizeUrl(link ?? ""),
			notes: (notes ?? "").trim() || null,
		})
		.select(
			"id,list_id,title,purchased,created_at,price_cents,link,image_url,notes,most_wanted,on_sale"
		)
		.single();

	if (error) throw error;
	if (!data || typeof data.id !== "string" || data.list_id !== listId) throw new Error("Could not confirm this gift was added. Refresh before trying again.");
	return data as ItemRow;
}

// Accept either UI-friendly patch (with `price` as string) or DB patch (with `price_cents`)
type PatchByUI = {
	title?: string;
	price?: string; // e.g. "24.99"
	link?: string | null;
	notes?: string | null;
};
type PatchByDB = Partial<
	Pick<
		ItemRow,
		"title" | "price_cents" | "link" | "notes" | "most_wanted" | "on_sale" | "image_url"
	>
>;

export async function updateItem(
	itemId: string,
	patch: PatchByUI
): Promise<void>;
export async function updateItem(
	itemId: string,
	patch: PatchByDB
): Promise<void>;
export async function updateItem(
	itemId: string,
	patch: PatchByUI | PatchByDB
): Promise<void> {
	const mapped: PatchByDB = {};

	if ("image_url" in patch) mapped.image_url = validateItemImage(patch.image_url);

	// title
	if ("title" in patch && typeof patch.title === "string") {
		mapped.title = patch.title.trim();
	}

	// price: support either `price` (string) or `price_cents` (number|null)
	if ("price" in patch) {
		const val = (patch as PatchByUI).price ?? "";
		mapped.price_cents = toCents(val);
	} else if ("price_cents" in patch) {
		mapped.price_cents = validatePriceCents((patch as PatchByDB).price_cents ?? null);
	}

	// link
	if ("link" in patch) {
		const v = patch.link;
		mapped.link = typeof v === "string" ? normalizeUrl(v) : v ?? null;
	}

	// notes
	if ("notes" in patch) {
		const v = patch.notes;
		mapped.notes = typeof v === "string" ? v.trim() || null : v ?? null;
	}

	// most_wanted
	if ("most_wanted" in patch) {
		mapped.most_wanted = patch.most_wanted;
	}

	// on_sale
	if ("on_sale" in patch) {
		mapped.on_sale = patch.on_sale;
	}

	// Remove undefined keys to avoid overwriting with undefined
	// Note: we need to keep false values for boolean fields like most_wanted
	const payload = Object.fromEntries(
		Object.entries(mapped).filter(([key, v]) => {
			// Keep boolean fields even if false
			if (key === "most_wanted" || key === "on_sale") return v !== undefined;
			// For other fields, filter out undefined
			return v !== undefined;
		})
	) as PatchByDB;

	if (Object.keys(payload).length === 0) throw new Error("No gift changes to save.");

	const { data, error } = await supabase
		.from("items")
		.update(payload)
		.eq("id", itemId).select("id").single();
	if (error) throw error;
	if (data?.id !== itemId) throw new Error("Could not confirm this gift was saved. Refresh before trying again.");
}

export type PurchaseState = { purchased: boolean; purchased_at: string | null };

/** The backend owns buyer identity, purchase time, and conflict handling. */
export async function togglePurchased(
	itemId: string,
	next: boolean
): Promise<PurchaseState> {
	const { data, error } = await supabase.rpc("set_item_purchase", {
		p_item_id: itemId,
		p_purchased: next,
	});
	if (error) throw error;
	if (
		!data || typeof data !== "object" || data.purchased !== next ||
		(next ? typeof data.purchased_at !== "string" || !Number.isFinite(Date.parse(data.purchased_at))
			: data.purchased_at !== null)
	) {
		throw new Error("Could not confirm the purchase change. Refresh to check its current status.");
	}
	return { purchased: data.purchased, purchased_at: data.purchased_at };
}

/** Delete an item. */
export async function deleteItem(itemId: string): Promise<void> {
	const { data, error } = await supabase.from("items").delete().eq("id", itemId).select("id").single();
	if (error) throw error;
	if (data?.id !== itemId) throw new Error("Could not confirm this gift was deleted. Refresh before trying again.");
}

export async function getListProgress(listId: string) {
	const { data, error } = await supabase
		.from("items")
		.select("purchased,most_wanted,on_sale", { count: "exact" })
		.eq("list_id", listId);

	if (error) throw error;

	const total = data?.length ?? 0;
	const purchased = data?.filter((i) => i.purchased).length ?? 0;
	return { total, purchased };
}
