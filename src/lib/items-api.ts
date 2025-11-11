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
		.select()
		.single();

	if (error) throw error;
	return data as ItemRow;
}


/** Patch an existing item. Returns void (use optimistic UI in the caller). */
export async function updateItem(
	itemId: string,
	patch: Partial<Pick<ItemRow, "title" | "price_cents" | "link" | "notes">>
): Promise<void> {
	const mapped = {
		...patch,
		// allow callers to pass price as string; normalize if so
		...(typeof (patch as any).price === "string"
			? { price_cents: toCents((patch as any).price) }
			: {}),
		link:
			typeof patch.link === "string" ? normalizeUrl(patch.link) : patch.link,
		notes:
			typeof patch.notes === "string"
				? patch.notes.trim() || null
				: patch.notes,
	};

	const { error } = await supabase
		.from("items")
		.update(mapped)
		.eq("id", itemId);
	if (error) throw error;
}

/** Toggle purchased flag. */
export async function togglePurchased(
	itemId: string,
	next: boolean
): Promise<void> {
	const { error } = await supabase
		.from("items")
		.update({ purchased: next })
		.eq("id", itemId);
	if (error) throw error;
}

/** Delete an item. */
export async function deleteItem(itemId: string): Promise<void> {
	const { error } = await supabase.from("items").delete().eq("id", itemId);
	if (error) throw error;
}
