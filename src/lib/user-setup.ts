import { supabase } from "@/lib/supabase";

export async function ensureProfileAndMembership() {
	const sb = supabase();
	const {
		data: { user },
	} = await sb.auth.getUser();
	if (!user) return;

	// 1. ensure profile exists
	await sb.from("profiles").upsert({
		id: user.id,
		display_name: user.email?.split("@")[0] ?? "New User",
	});

	// 2. get the default family id (from the SQL function)
	const { data: fam } = await sb.rpc("get_default_family_id");
	const family_id = fam as string;

	// 3. ensure membership exists
	await sb.from("family_members").upsert({
		family_id,
		user_id: user.id,
		role: "member",
	});
}
