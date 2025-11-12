"use client";
//Deps
import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

//components
import Link from "next/link";
import CreateListButton from "@/components/ui/create-list-button";
import { ManageListModal } from "@/components/ui/manage-list-modal";
import ListCard from "@/components/lists/list-card";

//ui components
import { GlareCard } from "@/components/ui/glare-card";
import { FestiveGlow } from "@/components/ui/festive-glow";
import Snowfall from "@/components/ui/snowfall";
import { StarsBackground } from "@/components/ui/stars-background";
import CountdownBanner from "@/components/ui/countdown-banner";
import { SkeletonCard } from "@/components/ui/skeleton-card";
import PageFade from "@/components/ui/page-fade";

// Helper to get progress for a list
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

export default function UserListsPage() {
	const router = useRouter();
	const [lists, setLists] = useState<
		| {
				id: string;
				title: string;
				created_at: string;
				total?: number;
				purchased?: number;
		  }[]
		| null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [manageList, setManageList] = useState<{
		id: string;
		title: string;
	} | null>(null);

	const [newTitle, setNewTitle] = useState("");
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// Refetch lists and recompute progress counts
	const refreshLists = useCallback(async () => {
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
			setLoading(false);
			return;
		}

		// Enrich lists with progress (total and purchased counts)
		const enriched = await Promise.all(
			(data ?? []).map(async (l) => {
				const progress = await getListProgress(l.id);
				return { ...l, ...progress };
			})
		);

		setLists(enriched);
		setLoading(false);
	}, [router]);

	useEffect(() => {
		let channel: ReturnType<typeof supabase.channel> | null = null;

		(async () => {
			// initial load
			await refreshLists();

			// subscribe to realtime changes on lists to refresh the grid
			channel = supabase
				.channel("lists:self")
				.on(
					"postgres_changes",
					{ event: "*", schema: "public", table: "lists" },
					() => {
						// refetch lists on insert/update/delete
						refreshLists();
					}
				)
				.subscribe();
		})();

		return () => {
			if (channel) {
				supabase.removeChannel(channel);
			}
		};
	}, [refreshLists]);

	async function handleRename() {
		if (!manageList) return;
		try {
			setSaving(true);
			const { error } = await supabase
				.from("lists")
				.update({ title: newTitle })
				.eq("id", manageList.id);
			if (error) throw error;

			setLists((prev) =>
				prev
					? prev.map((it) =>
							it.id === manageList.id ? { ...it, title: newTitle } : it
					  )
					: prev
			);

			setIsModalOpen(false);
			setManageList(null);
		} catch (err) {
			console.error("Rename failed:", err);
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete() {
		if (!manageList) return;
		try {
			setDeleting(true);
			const { error } = await supabase
				.from("lists")
				.delete()
				.eq("id", manageList.id);
			if (error) throw error;

			setLists((prev) =>
				prev ? prev.filter((it) => it.id !== manageList.id) : prev
			);

			setIsModalOpen(false);
			setManageList(null);
		} catch (err) {
			console.error("Delete failed:", err);
		} finally {
			setDeleting(false);
		}
	}

	if (loading) {
		return (
			<main className="relative min-h-screen px-6 py-8 space-y-6 overflow-hidden">
				<PageFade>
					<StarsBackground starColor="var(--stars-dim)" />
					<Snowfall
						className="pointer-events-none fixed inset-0 z-9999"
						count={70}
						speed={40}
						wind={0.18}
					/>
					<CountdownBanner initialNow={Date.now()} />
					{/* header skeleton */}
					<header className="mx-auto w-full max-w-5xl">
						<div className="text-center space-y-3">
							<div className="mx-auto h-8 w-40 rounded bg-white/10 animate-pulse" />
							<div className="mx-auto h-10 w-48 rounded-full bg-white/10 animate-pulse" />
						</div>
					</header>
					{/* cards grid skeleton */}
					<section
						className="grid grid-cols-1 sm:grid-cols-2 gap-8 justify-items-center"
						aria-label="Loading lists"
					>
						{[0, 1, 2, 3].map((k) => (
							<SkeletonCard
								key={k}
								className="w-full max-w-[720px] h-64 sm:h-72 lg:h-80 rounded-xl"
							/>
						))}
					</section>
				</PageFade>
			</main>
		);
	}

	if (error) {
		return <p className="text-red-600 px-6 py-8">Error: {error}</p>;
	}

	const rows = lists ?? [];
	const many = rows.length > 1;

	return (
		<main className="relative min-h-screen px-6 py-8 space-y-6 overflow-hidden">
			<PageFade>
				<StarsBackground starColor="var(--stars-dim)" />
				<CountdownBanner initialNow={Date.now()} />
				<header className="relative mx-auto w-full max-w-5xl">
					{/* title */}
					<div className="text-center my-7">
						<motion.h1
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25 }}
							className="text-4xl mb-2"
						>
							Your Lists
						</motion.h1>
						<CreateListButton
							onCreated={(newList) =>
								setLists((prev) => [newList, ...(prev ?? [])])
							}
						/>
					</div>
				</header>
				{rows.length === 0 ? (
					// No lists yet
					<FestiveGlow>
						<div className="rounded-xl border border-white/10 p-6 text-white/80">
							No lists yet. Click{" "}
							<span className="font-medium">“Create New List”</span> to get
							started.
						</div>
					</FestiveGlow>
				) : (
					// List cards grid
					<section
						className={`relative grid gap-8 ${
							many
								? "grid-cols-1 sm:grid-cols-2 justify-items-center"
								: "grid-cols-1 place-items-center max-w-3xl mx-auto"
						}`}
					>
						{rows.map((l) => (
							<ListCard
								key={l.id}
								list={l}
								onManage={(id, title) => {
									setManageList({ id, title });
									setNewTitle(title);
									setIsModalOpen(true);
								}}
							/>
						))}
						{isModalOpen && (
							<ManageListModal
								open={isModalOpen}
								list={manageList}
								newTitle={newTitle}
								setNewTitle={setNewTitle}
								saving={saving}
								deleting={deleting}
								onRename={handleRename}
								onDelete={handleDelete}
								onClose={() => {
									setIsModalOpen(false);
									setManageList(null);
								}}
							/>
						)}
					</section>
				)}
				<Snowfall count={70} speed={40} wind={0.18} />
			</PageFade>
		</main>
	);
}
