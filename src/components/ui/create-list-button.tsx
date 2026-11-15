"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createPortal } from "react-dom";

export default function CreateListButton({
	onCreated,
}: {
	onCreated?: (newList: any) => void;
}) {
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

			const { data: newList, error: insertErr } = await supabase
				.from("lists")
				.insert({ title: t, owner_user_id: user.id })
				.select()
				.single();

			if (insertErr) {
				setError(insertErr.message);
				setLoading(false);
				return;
			}

			setLoading(false);
			closeModal();
			if (onCreated && newList) {
				onCreated(newList);
			} else {
				startTransition(() => router.refresh());
			}
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
				className="ledger-button"
			>
				<span aria-hidden="true">＋</span> Create list
			</button>

			{/* Modal */}
			{open &&
				createPortal(
					<div
						className="ledger-theme ledger-dialog-backdrop fixed inset-0 z-9999 flex items-center justify-center"
						role="dialog"
						aria-modal="true"
						aria-label="Create new list"
					>
						<div
							className="absolute inset-0"
							onClick={closeModal}
							aria-hidden
						/>

						<div className="relative z-10 ledger-paper ledger-dialog">
							<h3>Create new list</h3>

							<label className="block">
								Name
							</label>
							<input
								ref={inputRef}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="ledger-input"
								placeholder="e.g. Mum's Christmas List"
								aria-label="List title"
							/>

							{error && (
								<div role="alert" className="ledger-error">{error}</div>
							)}

							<div className="ledger-dialog-actions">
								<button
									type="button"
									onClick={closeModal}
									className="ledger-secondary"
									disabled={loading}
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={handleCreate}
									className="ledger-button"
									disabled={loading}
								>
									{loading ? "Saving..." : "Save"}
								</button>
							</div>
						</div>
					</div>,
					document.body
				)}
		</>
	);
}
