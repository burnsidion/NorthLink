import { supabase } from "@/lib/supabase";
import { getProfileUser } from "@/lib/auth-helpers";
import type { ListWithProgress } from "@/components/lists/list-card";

/** Head counts avoid the API row limit and never fetch buyer information. */
export async function getListProgress(listId: string) {
	const [totalResult, purchasedResult] = await Promise.all([
		supabase.from("items").select("id", { count: "exact", head: true }).eq("list_id", listId),
		supabase.from("items").select("id", { count: "exact", head: true }).eq("list_id", listId).eq("purchased", true),
	]);
	if (totalResult.error) throw totalResult.error;
	if (purchasedResult.error) throw purchasedResult.error;
	const total = totalResult.count, purchased = purchasedResult.count;
	if (total === null || purchased === null || !Number.isSafeInteger(total) || !Number.isSafeInteger(purchased) ||
		total < 0 || purchased < 0 || purchased > total) throw new Error("Could not confirm the list totals.");
	return { total, purchased };
}

export async function getListsWithProgress(family: boolean): Promise<ListWithProgress[]> {
	const user = await getProfileUser();
	if (!user) throw new Error("Please sign in again to refresh your lists.");
	const { data, error } = family
		? await supabase.from("v_user_accessible_lists")
			.select("id,title,owner_user_id,owner_display_name,owner_avatar_url,created_at")
			.eq("shared_user_id", user.id).order("created_at", { ascending: false })
		: await supabase.from("lists").select("id,title,created_at,owner_user_id")
			.eq("owner_user_id", user.id).order("created_at", { ascending: false });
	if (error) throw error;
	if (!Array.isArray(data)) throw new Error("Could not read your lists.");
	const seen = new Set<string>();
	const lists = data.filter(list => {
		if (seen.has(list.id) || (family && list.owner_user_id === user.id)) return false;
		seen.add(list.id);
		return true;
	});
	return Promise.all(lists.map(async list => ({ ...list, ...await getListProgress(list.id) })));
}
