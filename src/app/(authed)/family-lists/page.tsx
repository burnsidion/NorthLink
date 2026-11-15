"use client";
//Deps
import { getListsWithProgress } from "@/lib/list-progress";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { RefreshNotice } from "@/components/ui/refresh-notice";

//components
import ListCard from "@/components/lists/list-card";
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

const loadLists = () => getListsWithProgress(true);

export default function FamilyListsPage() {
	const { data, error, loading, retry } = useRefreshingData(loadLists, "family-lists-progress");
	const lists = data ?? [];

	if (loading) {
		return (
			<main className="max-w-6xl mx-auto px-4 py-10 text-white">
				<StarsBackground />
				<Snowfall enableMeteors={true} meteorCount={3} />
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

	if (error && data === null) {
		return (
			<main className="max-w-6xl mx-auto px-4 py-10 text-white">
				<StarsBackground />
				<h1 className="heading-festive text-3xl sm:text-4xl font-bold mb-4">
					Shared Lists
				</h1>
				<RefreshNotice message={error} onRetry={retry} />
			</main>
		);
	}

	return (
		<main className="max-w-6xl mx-auto px-4 py-10 text-white">
			<StarsBackground />
			<Snowfall enableMeteors={true} meteorCount={3} />
			{error && <RefreshNotice message={error} onRetry={retry} />}
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
