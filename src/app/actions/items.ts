// app/actions/items.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";
import { togglePurchased } from "@/lib/items-api";

export async function addItem(listId: string, name: string) {
	const supabase = createSupabaseServer();
	const n = name?.trim();
	if (!listId || !n) return { error: "Missing list or name." };

	const { error } = await supabase
		.from("items")
		.insert({ list_id: listId, name: n });
	if (error) return { error: error.message };
	revalidatePath(`/lists/${listId}`);
	return { ok: true };
}

export async function toggleItem(id: string, listId: string, value: boolean) {
	try {
		await togglePurchased(id, value);
	} catch (error: unknown) {
		return { error: typeof error === "object" && error !== null && "message" in error &&
			typeof error.message === "string" ? error.message : "Could not save the purchase change." };
	}

	revalidatePath(`/lists/${listId}`);
	return { ok: true };
}

export async function deleteItem(id: string, listId: string) {
	const supabase = createSupabaseServer();
	const { error } = await supabase.from("items").delete().eq("id", id);
	if (error) return { error: error.message };
	revalidatePath(`/lists/${listId}`);
	return { ok: true };
}
