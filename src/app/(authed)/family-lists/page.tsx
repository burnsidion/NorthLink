"use client";
//Deps
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
	const [userId, setUserId] = useState<string | null>(null);
	const [userGroupId, setUserGroupId] = useState<string | null>(null);

	async function fetchFamilyLists() {
		try {
			// 1) Get the current user
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();

			if (userError || !user) {
				console.error("Error fetching user:", userError);
				router.push("/login");
				return;
			}

			const currentUserId = user.id;
			setUserId(currentUserId);

			// 2) Get user's family group
			const { data: memberData } = await supabase
				.from("group_members")
				.select("group_id")
				.eq("user_id", currentUserId)
				.limit(1)
				.maybeSingle();

			const groupId = memberData?.group_id;
			setUserGroupId(groupId);

			// 3) Fetch all accessible lists from the view
			const { data, error } = await supabase
				.from("v_user_accessible_lists")
				.select(
					"id,title,owner_user_id,owner_display_name,owner_avatar_url,created_at"
				)
				.eq("shared_user_id", currentUserId)
				.order("created_at", { ascending: false });

			if (error) {
				console.error("Error fetching accessible lists:", error);
				setError(error.message);
				setLoading(false);
				return;
			}

			// 4) Deduplicate by list ID and filter out lists owned by current user
			const seenIds = new Set<string>();
			const sharedLists = (data ?? []).filter((l) => {
				if (seenIds.has(l.id)) {
					return false;
				}
				if (l.owner_user_id === currentUserId) {
					return false;
				}
				seenIds.add(l.id);
				return true;
			});

			// 5) Enrich each list with item counts and group_id
			const enriched: ListWithProgress[] = await Promise.all(
				sharedLists.map(async (l) => {
					const progress = await getListProgress(l.id);
					return { ...l, ...progress, group_id: groupId };
				})
			);

			console.log("family-lists enriched:", enriched);

			setLists(enriched);
			setLoading(false);
		} catch (err) {
			console.error("Failed to fetch family lists:", err);
			setError("Failed to load family lists");
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchFamilyLists();

		// Subscribe to realtime changes on list_shares table
		const channel = supabase
			.channel("family-lists-list_shares")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "list_shares" },
				() => {
					console.log("Realtime update → refetching");
					fetchFamilyLists();
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, []);

	async function handleUnshare(listId: string, groupId: string) {
		try {
			const { error } = await supabase
				.from("list_shares")
				.delete()
				.eq("list_id", listId)
				.eq("group_id", groupId);

			if (error) {
				console.error("Error unsharing list:", error);
				toast.error("Only the list owner can unshare this list.");
				return;
			}

			toast.success("List unshared from family group");

			// Re-fetch to get the updated list from the view
			// This ensures all users see the change immediately
			await fetchFamilyLists();
		} catch (err) {
			console.error("Failed to unshare list:", err);
			toast.error("Failed to unshare list");
		}
	}

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
