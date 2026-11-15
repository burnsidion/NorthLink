import { supabase } from "@/lib/supabase";

export async function renameList(listId: string, input: string): Promise<string> {
	const title = input.trim();
	if (!title) throw new Error("Enter a list name.");
	const { data, error } = await supabase.from("lists").update({ title })
		.eq("id", listId).select("id,title").single();
	if (error) throw error;
	if (data?.id !== listId || typeof data.title !== "string" || !data.title.trim()) {
		throw new Error("Could not confirm the list was renamed.");
	}
	return data.title;
}

export async function deleteList(listId: string): Promise<void> {
	const { data, error } = await supabase.from("lists").delete()
		.eq("id", listId).select("id").single();
	if (error) throw error;
	if (data?.id !== listId) throw new Error("Could not confirm the list was deleted.");
}

export async function setListShared(listId: string, groupId: string, shared: boolean): Promise<void> {
	const query = shared
		? supabase.from("list_shares").insert({ list_id: listId, group_id: groupId })
		: supabase.from("list_shares").delete().eq("list_id", listId).eq("group_id", groupId);
	const { data, error } = await query.select("list_id,group_id").single();
	if (error) throw error;
	if (data?.list_id !== listId || data?.group_id !== groupId) {
		throw new Error("Could not confirm the sharing change.");
	}
}
