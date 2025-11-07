import { createSupabaseServer } from "@/lib/supabase";
import Link from "next/link";
import CreateListButton from "@/components/ui/create-list-button";
import GlareCard from "@/components/ui/glare-card";
import { FestiveGlow } from "@/components/ui/festive-glow";

export default async function UserListsPage() {
	const supabase = createSupabaseServer();

	const { data: lists, error } = await supabase
		.from("lists")
		.select("id,title,created_at")
		.order("created_at", { ascending: false });

	if (error) {
		return <p className="text-red-400 px-6 py-8">Error: {error.message}</p>;
	}
	const rows = lists ?? [];
	const ids = rows.map((r) => r.id);

	let progressById: Record<string, { total: number; purchased: number }> = {};
	if (ids.length) {
		const { data: prog } = await supabase
			.from("list_progress")
			.select("list_id,total_items,purchased_items")
			.in("list_id", ids);

		for (const p of prog ?? []) {
			progressById[p.list_id] = {
				total: Number(p.total_items) || 0,
				purchased: Number(p.purchased_items) || 0,
			};
		}
	}

	return (
		<main className="px-6 py-8 space-y-6">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Your Lists</h1>
				<CreateListButton />
			</header>

			{rows.length === 0 ? (
				<FestiveGlow>
					<div className="rounded-xl border border-white/10 p-6 text-white/80">
						No lists yet. Click{" "}
						<span className="font-medium">“Create New List”</span> to get
						started.
					</div>
				</FestiveGlow>
			) : (
				<section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{rows.map((l) => {
						const { total = 0, purchased = 0 } = progressById[l.id] || {};
						const pct = total ? Math.round((purchased / total) * 100) : 0;

						return (
							<GlareCard key={l.id}>
								<div className="flex flex-col gap-2">
									<h3 className="text-lg font-medium">{l.title}</h3>
									<p className="text-sm text-white/60">
										{total} item{total === 1 ? "" : "s"} •{" "}
										{new Date(l.created_at).toLocaleDateString()}
									</p>

									<div className="h-2 mt-2 rounded bg-white/10 overflow-hidden">
										<div
											className="h-full bg-emerald-400/80 transition-[width] duration-500"
											style={{ width: `${pct}%` }}
										/>
									</div>
									<p className="text-xs text-white/60 mt-1">{pct}% purchased</p>

									<div className="mt-3 flex gap-2">
										<Link
											href={`/lists/${l.id}`}
											className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
										>
											View List
										</Link>
									</div>
								</div>
							</GlareCard>
						);
					})}
				</section>
			)}
		</main>
	);
}
