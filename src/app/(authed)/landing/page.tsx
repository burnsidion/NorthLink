"use client";
//Deps
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTheme } from "next-themes";

// UI Components
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { FestiveGlow } from "@/components/ui/festive-glow";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import { EditOutlined, TeamOutlined, GiftOutlined } from "@ant-design/icons";
import CountdownBanner from "@/components/ui/countdown-banner";
import Snowfall from "@/components/ui/snowfall";
import { StarsBackground } from "@/components/ui/stars-background";
import PageFade from "@/components/ui/page-fade";

// Animation
import { motion } from "motion/react";
import Link from "next/link";
import { ListTodo, UsersRound } from "lucide-react";

const gridVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
	hidden: { opacity: 0, y: 12, filter: "blur(2px)" },
	show: {
		opacity: 1,
		y: 0,
		filter: "blur(0px)",
		transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
	},
};

export default function ListsPage() {
	const sb = supabase;
	const router = useRouter();
	const [email, setEmail] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		(async () => {
			const {
				data: { session },
			} = await sb.auth.getSession();
			if (!session) {
				router.replace("/login");
				return;
			}
			setEmail(session.user.email ?? null);
			const { data: prof, error } = await sb
				.from("profiles")
				.select("display_name")
				.eq("id", session.user.id)
				.maybeSingle();

			if (!error) {
				setDisplayName(prof?.display_name ?? null);
			} else {
				console.error("fetch profile failed:", error);
			}
			setTimeout(() => setLoading(false), 700);
		})();
	}, [router, sb]);

	return (
		<main className="relative mx-auto max-w-6xl min-h-dvh px-4 pb-24 pt-24 lg:pt-20">
			<PageFade>
				<StarsBackground starColor="var(--stars-dim)" />
				<div className="pointer-events-none fixed inset-0 z-9999">
					<Snowfall count={70} speed={40} wind={0.18} />
				</div>
				<CountdownBanner initialNow={Date.now()} />
				{/* Hero Section */}
				<HeroHighlight className="bg-none mt-12">
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
							ease: [0.4, 0.0, 0.2, 1],
						}}
						className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto "
					>
						Welcome {displayName !== null ? displayName : "shopper"}!
						<br />
						<Highlight className="text-black dark:text-white">
							Create
						</Highlight>{" "}
						your own lists.
						<br />
						<Highlight className="text-black dark:text-white">
							Browse
						</Highlight>{" "}
						Family Lists.
						<br />
						Keep{" "}
						<Highlight className="text-black dark:text-white">
							surprises
						</Highlight>{" "}
						secret!
					</motion.h1>
				</HeroHighlight>
				{/* Card Container */}
				<div className="h-24 sm:h-32 lg:h-40" />
				<motion.div
					className="grid grid-cols-1 md:grid-cols-2 gap-8 justify-items-center"
					variants={gridVariants}
					initial="hidden"
					animate="show"
				>
					{loading ? (
						// Loading Skeletons
						<>
							<motion.div variants={cardVariants}>
								<SkeletonCard />
							</motion.div>
							<motion.div variants={cardVariants}>
								<SkeletonCard />
							</motion.div>
						</>
					) : (
						<>
							{/* User Card */}
							<motion.div variants={cardVariants}>
								<FestiveGlow>
									<CardSpotlight
										color="#3b0f0f"
										className="relative w-full max-w-md h-96 text-center"
									>
										<div className="relative z-20 flex flex-col items-center justify-center h-full">
											<ListTodo
												className="h-6 w-6 text-red-600"
												strokeWidth={1.75}
												aria-hidden
											/>
											<span className="sr-only">My Lists</span>
											<h1 className="text-xl font-bold text-white">My Lists</h1>
											<p className="text-neutral-300 mt-4 text-sm">
												Once it’s ready, your lists will appear here for easy
												access.
											</p>
											<Link href="/user-lists" className="mt-6">
												<button className="rounded-md border border-white/10 px-5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 bg-red-600/80 hover:bg-red-600 text-white">
													View My Lists
												</button>
											</Link>
										</div>
									</CardSpotlight>
								</FestiveGlow>
							</motion.div>
							{/* Family Card */}
							<motion.div variants={cardVariants}>
								<FestiveGlow>
									<CardSpotlight
										color="#0f3b17"
										className="relative w-full max-w-md h-96 text-center"
									>
										<div className="relative z-20 flex flex-col items-center justify-center h-full">
											<UsersRound
												className="h-6 w-6 text-emerald-700"
												strokeWidth={1.75}
												aria-hidden
											/>
											<span className="sr-only">Family Lists</span>
											<h1 className="text-xl font-bold text-white">
												Family Lists
											</h1>
											<p className="text-neutral-300 mt-4 text-sm">
												Here is where you can view lists others have created
											</p>
											<Link href="/lists" className="mt-6">
												<button className="rounded-md border border-white/10 px-5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 bg-emerald-700/80 hover:bg-emerald-700 text-white">
													View User Lists
												</button>
											</Link>
										</div>
									</CardSpotlight>
								</FestiveGlow>
							</motion.div>
						</>
					)}
				</motion.div>
				{/* How It Works Section */}
				<div className="relative mt-24">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute -inset-0.5 rounded-2xl opacity-30 blur-xl"
						style={{
							background:
								"conic-gradient(from 0deg at 50% 50%, rgba(239,68,68,0.6), rgba(34,197,94,0.6), rgba(239,68,68,0.6))",
						}}
					/>
					<div className="relative rounded-2xl bg-black/50 p-8 text-center ring-1 ring-white/10">
						<h2 className="text-2xl font-bold mb-8 text-white">How It Works</h2>
						<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
							<div>
								<EditOutlined />
								<h3 className="text-lg font-semibold text-white">
									Create Your List
								</h3>
								<p className="mt-2 text-sm text-neutral-300">
									Add all the items you’re wishing for this Christmas.
								</p>
							</div>
							<div>
								<TeamOutlined />
								<h3 className="text-lg font-semibold text-white">
									Share With Others
								</h3>
								<p className="mt-2 text-sm text-neutral-300">
									Let friends and family see your wish list.
								</p>
							</div>
							<div>
								<GiftOutlined />
								<h3 className="text-lg font-semibold text-white">
									Track Purchases
								</h3>
								<p className="mt-2 text-sm text-neutral-300">
									Items are marked when claimed to avoid duplicates.
								</p>
							</div>
						</div>
					</div>
				</div>
			</PageFade>
		</main>
	);
}
