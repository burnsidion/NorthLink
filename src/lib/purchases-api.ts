import { itemImageUrl } from "@/lib/item-image";
import { supabase } from "@/lib/supabase";

export type PurchasedItem = {
	id: string;
	title: string;
	price_cents: number | null;
	link: string | null;
	image_url?: string | null;
	notes: string | null;
	most_wanted: boolean;
	list_title: string;
	list_owner_name: string;
};

function isPurchasedItem(value: unknown): value is PurchasedItem {
	if (typeof value !== "object" || value === null) return false;
	const row = value as Record<string, unknown>;
	return typeof row.id === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) &&
		typeof row.title === "string" &&
		(row.price_cents === null || (typeof row.price_cents === "number" &&
			Number.isSafeInteger(row.price_cents) && row.price_cents >= 0)) &&
		(row.link === null || typeof row.link === "string") &&
		(row.notes === null || typeof row.notes === "string") &&
		typeof row.most_wanted === "boolean" &&
		typeof row.list_title === "string" && typeof row.list_owner_name === "string";
}

/** Caller identity and list access are checked by the backend, never a filter. */
export async function getMyPurchases(): Promise<PurchasedItem[]> {
	const { data, error } = await supabase.rpc("get_my_purchases");
	if (error) throw error;
	if (!Array.isArray(data) || !data.every(isPurchasedItem)) {
		throw new Error("Could not read your purchases. Please refresh and try again.");
	}
	// Only carry the documented screen fields into client state.
	return data.map(({ id, title, price_cents, link, image_url, notes, most_wanted, list_title, list_owner_name }) =>
		({ id, title, price_cents, link, ...(image_url === undefined ? {} : { image_url: itemImageUrl(image_url) }), notes, most_wanted, list_title, list_owner_name }));
}
