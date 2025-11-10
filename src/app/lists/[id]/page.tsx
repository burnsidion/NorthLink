import { createSupabaseServer } from "@/lib/supabase";
import { addItem, toggleItem, deleteItem } from "@/app/actions/items";

type Params = { params: { id: string } };

export default async function ListDetail({ params }: Params) {
	const supabase = createSupabaseServer();

	const [{ data: list }, { data: items }] = await Promise.all([
		supabase
			.from("lists")
			.select("id,title,created_at")
			.eq("id", params.id)
			.single(),
		supabase
			.from("items")
			.select("id,name,purchased,created_at")
			.eq("list_id", params.id)
			.order("created_at", { ascending: true }),
	]);

	if (!list) {
		return (
			<main className="px-6 py-8">
				<p className="text-red-400">List not found.</p>
			</main>
		);
	}

	return (
		<main className="px-6 py-8 max-w-2xl mx-auto space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-semibold">{list.title}</h1>
				<p className="text-sm text-white/60">
					{new Date(list.created_at).toLocaleString()}
				</p>
			</header>

			{/* Add item */}
			<form
				action={async (formData) => {
					"use server";
					const name = String(formData.get("name") || "");
					await addItem(list.id, name);
				}}
				className="flex gap-2"
			>
				<input
					name="name"
					placeholder="Add an item…"
					maxLength={120}
					className="flex-1 rounded-lg bg-neutral-800 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400/40"
				/>
				<button className="px-3 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-black font-medium">
					Add
				</button>
			</form>

			{/* Items list */}
			<ul className="space-y-2">
				{(items ?? []).map((it) => (
					<li
						key={it.id}
						className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/2 px-3 py-2"
					>
						<form
							action={async () => {
								"use server";
								await toggleItem(it.id, list.id, !it.purchased);
							}}
						>
							<button
								aria-label={
									it.purchased ? "Mark unpurchased" : "Mark purchased"
								}
								className={`h-5 w-5 rounded border ${
									it.purchased
										? "bg-emerald-400/80 border-emerald-300"
										: "border-white/20"
								}`}
							/>
						</form>
						<span
							className={`flex-1 ${
								it.purchased ? "line-through text-white/50" : ""
							}`}
						>
							{it.name}
						</span>
						<form
							action={async () => {
								"use server";
								await deleteItem(it.id, list.id);
							}}
						>
							<button className="text-sm rounded-lg bg-red-500/80 hover:bg-red-400 text-black px-2 py-1">
								Delete
							</button>
						</form>
					</li>
				))}
			</ul>
		</main>
	);
}
