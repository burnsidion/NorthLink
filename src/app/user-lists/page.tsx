"use client";
//Deps
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

//components
import Link from "next/link";
import CreateListButton from "@/components/ui/create-list-button";

//ui components
import { GlareCard } from "@/components/ui/glare-card";
import { FestiveGlow } from "@/components/ui/festive-glow";
import Snowfall from "@/components/ui/snowfall";
import { TextAnimate } from "@/components/ui/text-animate";

export default function UserListsPage() {
	const router = useRouter();
	const [lists, setLists] = useState<
		{ id: string; title: string; created_at: string }[] | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchData() {
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();

			if (userError || !user) {
				router.push("/signin");
				return;
			}

			const { data, error } = await supabase
				.from("lists")
				.select("id,title,created_at")
				.eq("owner_user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) {
				setError(error.message);
			} else {
				setLists(data);
			}
			setLoading(false);
		}

		fetchData();
	}, [router]);

	if (loading) {
		return <p className="px-6 py-8 text-white/80">Loading...</p>;
	}

	if (error) {
		return <p className="text-red-400 px-6 py-8">Error: {error}</p>;
	}

	const rows = lists ?? [];

	return (
		<main className="relative min-h-screen px-6 py-8 space-y-6 bg-linear-to-b from-[#1a0000] via-[#2b0000] to-[#3b1a00] overflow-hidden">
			<Snowfall
				className="absolute inset-0 z-0"
				count={70}
				speed={40}
				wind={0.18}
			/>
			<header className="flex flex-col items-center justify-center text-center relative z-10 space-y-2">
				<TextAnimate
					animation="blurInUp"
					by="character"
					once
					className="text-4xl font-semibold"
				>
					Your Lists
				</TextAnimate>
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
				<section className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 justify-items-center">
					{rows.map((l) => (
						<GlareCard containerClassName="h-64 sm:h-72 lg:h-80" key={l.id}>
							<div className="flex flex-col justify-between h-full w-full p-4">
								<div className="flex flex-col items-center">
									<h2 className="text-3xl font-semibold text-white break-words">
										{l.title}
									</h2>
									<p className="text-md text-white/70 mb-4">
										{/* Removed progress bar logic */}
										{new Date(l.created_at).toLocaleDateString()}
									</p>
								</div>

								<div className="mt-auto">
									<Link
										href={`/lists/${l.id}`}
										aria-label={`View list ${l.title}`}
										className="block w-full text-center px-3 py-2 rounded-lg bg-red-900 hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black text-sm font-medium"
									>
										View List
									</Link>
								</div>
							</div>
						</GlareCard>
					))}
				</section>
			)}
		</main>
	);
}
