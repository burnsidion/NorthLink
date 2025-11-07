"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CreateListButton() {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	function openModal() {
		startTransition(() => setOpen(true));
	}

	function closeModal() {
		setOpen(false);
		setTitle("");
		setError(null);
		setLoading(false);
	}

	// Auto-focus input on open
	useEffect(() => {
		if (open) {
			const id = setTimeout(() => inputRef.current?.focus(), 50);
			return () => clearTimeout(id);
		}
	}, [open]);

	// Close on Escape
	useEffect(() => {
		if (!open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") closeModal();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	async function handleCreate() {
		const t = title.trim();
		if (!t) {
			setError("Title is required.");
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const {
				data: { user },
				error: userErr,
			} = await supabase.auth.getUser();

			if (userErr || !user) {
				setError(userErr?.message ?? "You must be signed in to create a list.");
				setLoading(false);
				return;
			}

			const { error: insertErr } = await supabase
				.from("lists")
				.insert({ title: t, owner_user_id: user.id });

			if (insertErr) {
				setError(insertErr.message);
				setLoading(false);
				return;
			}

			setLoading(false);
			closeModal();
			startTransition(() => router.refresh());
		} catch (e: any) {
			setError(e?.message ?? String(e));
			setLoading(false);
		}
	}

	return (
		<>
			{/* Trigger button */}
			<button
				onClick={openModal}
				aria-busy={pending}
				disabled={pending}
				className="relative inline-flex h-12 overflow-hidden rounded-full p-px focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
			>
				<span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#FF0000_0%,#008000_50%,#FFFFFF_100%)]" />
				<span className="inline-flex h-full w-full items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-medium text-white backdrop-blur-3xl">
					Create New List
				</span>
			</button>

			{/* Modal */}
			{open && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center"
					role="dialog"
					aria-modal="true"
				>
					<div
						className="absolute inset-0 bg-black/50"
						onClick={closeModal}
						aria-hidden
					/>

					<div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900">
						<h3 className="mb-2 text-lg font-semibold">Create new list</h3>

						<label className="mb-2 block text-sm text-slate-600 dark:text-slate-300">
							Name
						</label>
						<input
							ref={inputRef}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="mb-3 w-full rounded border px-3 py-2 text-sm dark:bg-slate-800 dark:text-white"
							placeholder="e.g. Mum's Christmas List"
							aria-label="List title"
						/>

						{error && <div className="mb-3 text-sm text-red-500">{error}</div>}

						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={closeModal}
								className="rounded px-3 py-1 text-sm"
								disabled={loading}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleCreate}
								className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-50"
								disabled={loading}
							>
								{loading ? "Saving..." : "Save"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
