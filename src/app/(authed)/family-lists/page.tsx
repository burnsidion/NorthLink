"use client";
//Deps
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

//components
import ListCard, { ListWithProgress } from "@/components/lists/list-card";
import Snowfall from "@/components/ui/snowfall";
import { StarsBackground } from "@/components/ui/stars-background";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import CountdownBanner from "@/components/ui/countdown-banner";

//Animation
import { motion } from "motion/react";

const gridVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
	hidden: { opacity: 0, y: 20, scale: 0.95 },
	show: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as any },
	},
};

async function getListProgress(listId: string) {
	const { count: total, error: totalErr } = await supabase
		.from("items")
		.select("id", { count: "exact", head: true })
		.eq("list_id", listId);

	const { count: purchased, error: purchasedErr } = await supabase
		.from("items")
		.select("id", { count: "exact", head: true })
		.eq("list_id", listId)
		.eq("purchased", true);

	if (totalErr) throw totalErr;
	if (purchasedErr) throw purchasedErr;

	return {
		total: total ?? 0,
		purchased: purchased ?? 0,
	};
}

export default function FamilyListsPage() {
	const router = useRouter();

	const [lists, setLists] = useState<ListWithProgress[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;

		(async () => {
			// 1) Get the current user
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();

			if (!alive) return;

			if (userError || !user) {
				console.error("Error fetching user:", userError);
				router.push("/login");
				return;
			}

			const userId = user.id;

			// 2) Fetch all accessible lists from the view
			const { data, error } = await supabase
				.from("v_user_accessible_lists")
				.select(
					"id,title,owner_user_id,owner_display_name,owner_avatar_url,created_at"
				)
				.order("created_at", { ascending: false });

			if (!alive) return;

			if (error) {
				console.error("Error fetching accessible lists:", error);
				setError(error.message);
				setLoading(false);
				return;
			}

			// 3) Filter to only lists owned by OTHER users and deduplicate by list ID
			const seenIds = new Set<string>();
			const sharedLists = (data ?? []).filter((l) => {
				if (l.owner_user_id === userId || seenIds.has(l.id)) {
					return false;
				}
				seenIds.add(l.id);
				return true;
			});

			// 4) Enrich each list with item counts
			const enriched: ListWithProgress[] = await Promise.all(
				sharedLists.map(async (l) => {
					const progress = await getListProgress(l.id);
					return { ...l, ...progress };
				})
			);

			console.log("family-lists enriched:", enriched);

			setLists(enriched);
			setLoading(false);
		})();

		return () => {
			alive = false;
		};
	}, [router]);

	if (loading) {
		return (
			<main className="max-w-6xl mx-auto px-4 py-10 text-white">
				<StarsBackground />
				<Snowfall />
				<HeroHighlight className="bg-none mb-12">
					<motion.h1
						initial={{
							opacity: 0,
							y: 20,
						}}
						animate={{
							opacity: 1,
							y: [20, -5, 0],
						}}
						transition={{
							duration: 0.5,
							ease: [0.4, 0.0, 0.2, 1] as any,
						}}
						className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto "
					>
						<Highlight className="text-black dark:text-white">Browse</Highlight>{" "}
						wish lists from your
						<br />
						<Highlight className="text-black dark:text-white">
							friends and family
						</Highlight>
					</motion.h1>
				</HeroHighlight>
				<section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<SkeletonCard key={i} className="h-64 sm:h-72 lg:h-80" />
					))}
				</section>
			</main>
		);
	}

	if (error) {
		return (
			<main className="max-w-6xl mx-auto px-4 py-10 text-white">
				<StarsBackground />
				<h1 className="heading-festive text-3xl sm:text-4xl font-bold mb-4">
					Shared Lists
				</h1>
				<p>Something went wrong loading your shared lists.</p>
			</main>
		);
	}

	return (
		<main className="max-w-6xl mx-auto px-4 py-10 text-white">
			<StarsBackground />
			<Snowfall />
			<CountdownBanner initialNow={Date.now()} />
			<HeroHighlight className="bg-none mb-12">
				<motion.h1
					initial={{
						opacity: 0,
						y: 20,
					}}
					animate={{
						opacity: 1,
						y: [20, -5, 0],
					}}
					transition={{
						duration: 0.5,
						ease: [0.4, 0.0, 0.2, 1] as any,
					}}
					className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto "
				>
					<Highlight className="text-black dark:text-white">Browse</Highlight>{" "}
					wish lists from your
					<br />
					<Highlight className="text-black dark:text-white">
						friends and family
					</Highlight>{" "}
					{/* Family Lists. */}
					<br />{" "}
					<Highlight className="text-black dark:text-white">Click</Highlight>
					on a list to view items and mark gifts as{" "}
					<Highlight className="text-black dark:text-white">
						purchased
					</Highlight>
				</motion.h1>
			</HeroHighlight>

			{lists.length === 0 ? (
				<p className="text-white/70 text-center">
					You don&apos;t have any shared lists yet. Once friends or family share
					lists with you, they&apos;ll appear here.
				</p>
			) : (
				<motion.section
					className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
					variants={gridVariants}
					initial="hidden"
					animate="show"
				>
					{lists.map((list, index) => (
						<motion.div key={list.id} variants={cardVariants}>
							<ListCard list={list} index={index} hideManageButton showOwner />
						</motion.div>
					))}
				</motion.section>
			)}
		</main>
	);
}
