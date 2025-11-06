"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";

export async function createList(title: string) {
	const supabase = createSupabaseServer();
	const t = title?.trim();
	if (!t) return { error: "Title is required." };

	const { error } = await supabase.from("lists").insert({ title: t });
	if (error) return { error: error.message };

	revalidatePath("/user-lists");
	return { ok: true };
}
