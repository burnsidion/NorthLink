"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase";

export async function createList(formData: FormData) {
	const title = String(formData.get("title") || "").trim();
	const familyId = formData.get("family_id") as string | null;

	if (!title) return { error: "Title is required." };

	const supabase = createSupabaseServer();

	const {
		data: { user },
		error: userErr,
	} = await supabase.auth.getUser();
	if (userErr || !user) return { error: "Not signed in." };

	const { error } = await supabase.from("lists").insert({
		title,
		owner_user_id: user.id,
		...(familyId ? { family_id: familyId } : {}),
	});

	if (error) return { error: error.message };

	revalidatePath("/user-lists");
	return { ok: true };
}

export async function updateListTitle(listId: string, newTitle: string) {
	const supabase = createSupabaseServer();
	const title = newTitle.trim();
	if (!title) return { error: "Title cannot be empty." };

	const { error } = await supabase
		.from("lists")
		.update({ title })
		.eq("id", listId);
	if (error) return { error: error.message };

	revalidatePath("/user-lists");
	return { ok: true };
}

export async function deleteList(listId: string) {
	const supabase = createSupabaseServer();
	const { error } = await supabase.from("lists").delete().eq("id", listId);
	if (error) return { error: error.message };

	revalidatePath("/user-lists");
	return { ok: true };
}
