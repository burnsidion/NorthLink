"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion } from "motion/react";

// Components
import Snowfall from "@/components/ui/snowfall";
import ColourfulText from "@/components/ui/colourful-text";
import { StarsBackground } from "@/components/ui/stars-background";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import CountdownBanner from "@/components/ui/countdown-banner";
import { TextAnimate } from "@/components/ui/text-animate";
import { usd } from "@/lib/format";

// Types
type PurchasedItem = {
	id: string;
	title: string;
	price_cents: number | null;
	link: string | null;
	notes: string | null;
	list_title: string;
	list_owner_name: string;
};

const gridVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
	hidden: { opacity: 0, y: 20, scale: 0.95 },
	show: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
	},
};

export default function PurchasedItemsPage() {
	const router = useRouter();
	const [items, setItems] = useState<PurchasedItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;

		(async () => {
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();

			if (!alive) return;

			if (userError || !user) {
				router.push("/login");
				return;
			}

			// Query items that this user has purchased
			// We'll need to join with lists and v_user_accessible_lists to get list details
			const { data, error: itemsError } = await supabase
				.from("items")
				.select(
					`
						id,
						title,
						price_cents,
						link,
						notes,
						list_id,
						lists!inner (
							id,
							title,
							owner_user_id
						)
					`
				)
				.eq("purchased_by", user.id);

			let ownerNamesByListId: Record<string, string> = {};

			const listIds = Array.from(
				new Set((data ?? []).map((item: any) => item.list_id as string))
			);

			if (listIds.length > 0) {
				const { data: listMeta, error: listMetaError } = await supabase
					.from("v_user_accessible_lists")
					.select("id, owner_display_name")
					.in("id", listIds);

				if (listMetaError) {
					console.error(
						"Error fetching list metadata for purchased items:",
						listMetaError
					);
				} else {
					ownerNamesByListId = Object.fromEntries(
						(listMeta ?? []).map((row: any) => [
							row.id as string,
							row.owner_display_name as string,
						])
					);
				}
			}

			if (!alive) return;

			if (itemsError) {
				console.error("Error fetching purchased items:", itemsError);
				setError(itemsError.message);
				setLoading(false);
				return;
			}

			// Transform the data
			const transformed: PurchasedItem[] = (data ?? []).map((item: any) => ({
				id: item.id,
				title: item.title,
				price_cents: item.price_cents,
				link: item.link,
				notes: item.notes,
				list_title: item.lists.title,
				list_owner_name: ownerNamesByListId[item.list_id] ?? "List owner",
			}));

			setItems(transformed);
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
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: [20, -5, 0] }}
						transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
						className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto"
					>
						Your{" "}
						<Highlight className="text-black dark:text-white">
							Purchased
						</Highlight>{" "}
						Gifts
					</motion.h1>
				</HeroHighlight>
				<section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<SkeletonCard key={i} className="h-48" />
					))}
				</section>
			</main>
		);
	}

	if (error) {
		return (
			<main className="max-w-6xl mx-auto px-4 py-10 text-white">
				<StarsBackground />
				<Snowfall />
				<h1 className="heading-festive text-3xl sm:text-4xl font-bold mb-4">
					Purchased Gifts
				</h1>
				<p className="text-red-600">Error loading purchased items: {error}</p>
			</main>
		);
	}

	return (
		<main className="max-w-6xl mx-auto px-4 py-10 text-white">
			<StarsBackground />
			<Snowfall />
			<CountdownBanner initialNow={Date.now()} />
			<TextAnimate
				className="text-3xl text-center sm:text-4xl font-bold mt-5"
				animation="blurInUp"
				by="character"
				once
			>
				Your Purchased Gifts
			</TextAnimate>
			<HeroHighlight className="bg-none mb-12">
				<motion.h1
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: [20, -5, 0] }}
					transition={{ duration: 0.5, ease: [0.4, 0.0, 0.2, 1] }}
					className="heading-festive text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto"
				>
					<br />
					Keep track of all the gifts{" "}
					<Highlight className="text-black dark:text-white">
						you
					</Highlight> have{" "}
					<Highlight className="text-black dark:text-white">
						purchased
					</Highlight>
				</motion.h1>
			</HeroHighlight>

			{items.length === 0 ? (
				<div className="text-center py-12">
					<p className="text-white/70 text-lg">
						You have not purchased any gifts yet.
					</p>
					<p className="text-white/50">
						When you mark items as purchased on family lists, they will appear
						here.
					</p>
				</div>
			) : (
				<motion.section
					className={
						items.length === 1
							? "flex justify-center"
							: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
					}
					variants={gridVariants}
					initial="hidden"
					animate="show"
				>
					{items.map((item, index) => {
						const isGreen = index % 2 === 0;
						return (
							<motion.div
								key={item.id}
								variants={cardVariants}
								className={items.length === 1 ? "w-full max-w-xl" : ""}
							>
								<div
									className={`relative h-full min-h-80 overflow-hidden rounded-xl border p-8 backdrop-blur-sm transition-all ${
										isGreen
											? "border-emerald-700/20 bg-linear-to-br from-emerald-900/30 to-emerald-950/20 hover:border-red-600/70 hover:shadow-lg hover:shadow-red-600/20"
											: "border-red-700/20 bg-linear-to-br from-red-900/30 to-red-950/20 hover:border-emerald-600/70 hover:shadow-lg hover:shadow-emerald-600/20"
									}`}
								>
									{/* Item Title */}
									<h3 className="text-2xl font-semibold mb-4 text-white">
										{item.title}
									</h3>

									{/* List and Owner Info */}
									<div className="mb-4 space-y-1">
										<p className="text-sm text-white/60">
											From:{" "}
											<span className="text-white/90">
												{item.list_owner_name}
											</span>
										</p>
										<p className="text-sm text-white/60">
											List:{" "}
											<span className="text-white/90">{item.list_title}</span>
										</p>
									</div>

									{/* Price */}
									{typeof item.price_cents === "number" && (
										<p className="text-2xl font-bold text-emerald-700 mb-3">
											{usd.format(item.price_cents / 100)}
										</p>
									)}

									{/* Notes */}
									{item.notes && (
										<div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/5">
											<p className="text-sm text-white/70 italic">
												&ldquo;{item.notes}&rdquo;
											</p>
										</div>
									)}

									{/* Link */}
									{item.link && (
										<a
											href={item.link}
											target="_blank"
											rel="noreferrer"
											className={`inline-block px-4 py-2 text-white rounded-lg text-sm font-medium transition-colors ${
												isGreen
													? "bg-red-700/80 hover:bg-red-700"
													: "bg-emerald-700/80 hover:bg-emerald-700"
											}`}
										>
											View Item
										</a>
									)}
								</div>
							</motion.div>
						);
					})}
				</motion.section>
			)}
		</main>
	);
}
