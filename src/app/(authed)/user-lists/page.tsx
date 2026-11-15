"use client";
//Deps
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { renameList, deleteList } from "@/lib/lists-api";

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

	const mounted = useRef(false);
	const actionPending = useRef(false);
	const [actionError, setActionError] = useState<string | null>(null);
	useEffect(() => {
		mounted.current = true;
		return () => { mounted.current = false; };
	}, []);

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
			router.push("/login"); // or "/signin" if that's what you're using now
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
		if (!manageList || actionPending.current || !mounted.current) return;
		if (!newTitle.trim()) { setActionError("Enter a list name."); return; }
		actionPending.current = true;
		setSaving(true);
		setActionError(null);
		const listId = manageList.id;
		try {
			const savedTitle = await renameList(listId, newTitle);
			if (!mounted.current) return;
			setLists(previous => previous?.map(list => list.id === listId ? { ...list, title: savedTitle } : list) ?? null);
			setIsModalOpen(false);
			setManageList(null);
			toast.success("List renamed");
		} catch {
			if (!mounted.current) return;
			const message = "We couldn’t confirm the rename. Your changes are still here. Refresh to check the list before trying again.";
			setActionError(message);
			toast.error(message);
		} finally {
			actionPending.current = false;
			if (mounted.current) setSaving(false);
		}
	}

	async function handleDelete() {
		if (!manageList || actionPending.current || !mounted.current) return;
		actionPending.current = true;
		setDeleting(true);
		setActionError(null);
		const listId = manageList.id;
		try {
			await deleteList(listId);
			if (!mounted.current) return;
			setLists(previous => previous?.filter(list => list.id !== listId) ?? null);
			setIsModalOpen(false);
			setManageList(null);
			toast.success("List deleted");
		} catch {
			if (!mounted.current) return;
			const message = "We couldn’t confirm this list was deleted. Refresh to check its current status before trying again.";
			setActionError(message);
			toast.error(message);
		} finally {
			actionPending.current = false;
			if (mounted.current) setDeleting(false);
		}
	}

	if (loading) {
		return (
			<main className="relative min-h-screen px-6 py-8 space-y-6 overflow-hidden">
				<PageFade>
					<StarsBackground />
					<Snowfall
						count={70}
						speed={40}
						wind={0.18}
						enableMeteors={true}
						meteorCount={3}
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
				<StarsBackground />
				<CountdownBanner initialNow={Date.now()} />
				<header className="relative mx-auto w-full max-w-5xl">
					{/* title */}
					<div className="text-center my-7 flex flex-col gap-3">
						<motion.h1
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.25 }}
							className="heading-festive text-6xl mb-2"
						>
							Your Lists
						</motion.h1>
						<div>
							<CreateListButton
								onCreated={(newList) =>
									setLists((prev) => [newList, ...(prev ?? [])])
								}
							/>
						</div>
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
						{rows.map((l, index) => (
							<ListCard
								key={l.id}
								list={l}
								index={index}
								onManage={(id, title) => {
									if (actionPending.current) return;
									setActionError(null);
									setManageList({ id, title });
									setNewTitle(title);
									setIsModalOpen(true);
								}}
							/>
						))}
					</section>
				)}
				{isModalOpen && (
					<ManageListModal
						open={isModalOpen}
						list={manageList}
						newTitle={newTitle}
						setNewTitle={setNewTitle}
						saving={saving}
						deleting={deleting}
						error={actionError}
						onRename={handleRename}
						onDelete={handleDelete}
						onClose={() => {
							if (actionPending.current) return;
							setIsModalOpen(false);
							setManageList(null);
						}}
					/>
				)}
				<Snowfall count={70} speed={40} wind={0.18} />
			</PageFade>
		</main>
	);
}
