"use client";
//Deps
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

//components
import Link from "next/link";
import CreateListButton, {
	glowButtonClasses,
} from "@/components/ui/create-list-button";
import { ManageListModal } from "@/components/ui/manage-list-modal";

//ui components
import { GlareCard } from "@/components/ui/glare-card";
import { FestiveGlow } from "@/components/ui/festive-glow";
import Snowfall from "@/components/ui/snowfall";
import { TextAnimate } from "@/components/ui/text-animate";
import CountdownBanner from "@/components/ui/countdown-banner";

//Icons
import { EditOutlined, HomeOutlined } from "@ant-design/icons";

export default function UserListsPage() {
	const router = useRouter();
	const [lists, setLists] = useState<
		{ id: string; title: string; created_at: string }[] | null
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
			<CountdownBanner initialNow={Date.now()} />
			<header className="relative z-10 mx-auto w-full max-w-5xl">
				{/* toolbar */}
				<div className="mb-3 flex items-center justify-between">
					<Link
						href="/landing"
						aria-label="Go to Home"
						title="Home"
						className={glowButtonClasses.outer}
					>
						<span className={glowButtonClasses.spinner} />
						<span className={glowButtonClasses.inner}>
							<HomeOutlined className="mr-2" />
							<span className="hidden sm:inline">Home</span>
						</span>
					</Link>

					<CreateListButton
						onCreated={(newList) =>
							setLists((prev) => [newList, ...(prev ?? [])])
						}
					/>
				</div>

				{/* title */}
				<div className="text-center">
					<TextAnimate
						animation="blurInUp"
						by="character"
						once
						className="text-3xl sm:text-4xl font-semibold"
					>
						Your Lists
					</TextAnimate>
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
				<section className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-8 justify-items-center">
					{rows.map((l) => (
						<GlareCard containerClassName="h-64 sm:h-72 lg:h-80" key={l.id}>
							<div className="relative flex flex-col justify-between h-full w-full p-4">
								<div className="flex flex-col items-center">
									<h2 className="text-3xl font-semibold text-white wrap-break-word">
										{l.title}
									</h2>
									<button
										onClick={() => {
											setManageList({ id: l.id, title: l.title });
											setNewTitle(l.title);
											setIsModalOpen(true);
										}}
										aria-label={`Manage list ${l.title}`}
										className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white hover:bg-black/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
									>
										<EditOutlined className="text-white/90" />
									</button>
									<p className="text-md text-white/70 mb-4">
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
		</main>
	);
}
