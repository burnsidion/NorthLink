// app/actions/items.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";

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
	const supabase = createSupabaseServer();
	const { error } = await supabase
		.from("items")
		.update({ purchased: value })
		.eq("id", id);
	if (error) return { error: error.message };
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
