// src/lib/items-api.ts
import { supabase } from "@/lib/supabase";
import { toCents, normalizeUrl } from "@/lib/format";
import type { ItemRow } from "@/types/db";

/** Create a new item on a list. Returns the inserted row. */
export async function addItem(
	listId: string,
	input: {
		title: string;
		price?: string; // "24.99" (optional)
		link?: string; // raw url (optional)
		notes?: string; // optional
	}
): Promise<ItemRow> {
	const { title, price, link, notes } = input;

	const { data, error } = await supabase
		.from("items")
		.insert({
			list_id: listId,
			title: title.trim(),
			price_cents: toCents(price ?? ""),
			link: normalizeUrl(link ?? ""),
			notes: (notes ?? "").trim() || null,
		})
		.select(
			"id,list_id,title,purchased,created_at,price_cents,link,notes,most_wanted,on_sale"
		)
		.single();

	if (error) throw error;
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
		"title" | "price_cents" | "link" | "notes" | "most_wanted" | "on_sale"
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

	// title
	if ("title" in patch && typeof patch.title === "string") {
		mapped.title = patch.title.trim();
	}

	// price: support either `price` (string) or `price_cents` (number|null)
	if ("price" in patch) {
		const val = (patch as PatchByUI).price ?? "";
		mapped.price_cents = toCents(val);
	} else if ("price_cents" in patch) {
		mapped.price_cents = (patch as PatchByDB).price_cents ?? null;
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
		console.log("updateItem: most_wanted patch:", patch.most_wanted);
	}

	// on_sale
	if ("on_sale" in patch) {
		mapped.on_sale = patch.on_sale;
		console.log("updateItem: on_sale patch:", patch.on_sale);
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

	console.log("updateItem: final payload:", payload);

	const { error } = await supabase
		.from("items")
		.update(payload)
		.eq("id", itemId);
	if (error) throw error;
}

/** Toggle purchased flag. */
export async function togglePurchased(
	itemId: string,
	next: boolean
): Promise<void> {
	// Get current user
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("User not authenticated");

	// Prepare update payload
	const payload: {
		purchased: boolean;
		purchased_by: string | null;
		purchased_at: string | null;
	} = {
		purchased: next,
		purchased_by: next ? user.id : null,
		purchased_at: next ? new Date().toISOString() : null,
	};

	const { error } = await supabase
		.from("items")
		.update(payload)
		.eq("id", itemId);
	if (error) throw error;
}

/** Delete an item. */
export async function deleteItem(itemId: string): Promise<void> {
	const { error } = await supabase.from("items").delete().eq("id", itemId);
	if (error) throw error;
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
