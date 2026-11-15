"use client";

import React from "react";
import { DeleteOutlined } from "@ant-design/icons";

interface ManageListModalProps {
	open: boolean;
	list: { id: string; title: string } | null;
	newTitle: string;
	setNewTitle: (val: string) => void;
	saving: boolean;
	deleting: boolean;
	error?: string | null;
	onRename: () => Promise<void>;
	onDelete: () => Promise<void>;
	onClose: () => void;
}

export function ManageListModal({
	open,
	list,
	newTitle,
	setNewTitle,
	saving,
	deleting,
	error,
	onRename,
	onDelete,
	onClose,
}: ManageListModalProps) {
	if (!open || !list) return null;

	return (
		<div
			className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-4"
			role="dialog"
			aria-modal="true"
			aria-busy={saving || deleting}
			aria-label="Manage list"
			onClick={(e) => {
				if (!saving && !deleting && e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0c0f10] p-5 text-white shadow-xl">
				<h3 className="text-lg font-semibold mb-3">Manage “{list.title}”</h3>

				<label
					className="block text-sm text-white/80 mb-1"
					htmlFor="list-title"
				>
					Rename
				</label>

				<input
					disabled={saving || deleting}
					id="list-title"
					type="text"
					className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 outline-none focus:ring-2 focus:ring-white/60"
					value={newTitle}
					onChange={(e) => setNewTitle(e.target.value)}
				/>

				{error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
				<div className="mt-4 flex items-center justify-between gap-2">
					<button
						onClick={onDelete}
						disabled={saving || deleting}
						className="inline-flex items-center gap-2 rounded-md border border-red-600/60 bg-red-600/70 px-3 py-2 text-sm hover:bg-red-600 disabled:opacity-60"
					>
						<DeleteOutlined /> {deleting ? "Deleting…" : "Delete"}
					</button>

					<div className="ml-auto flex gap-2">
						<button
							onClick={onClose}
							disabled={saving || deleting}
							className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm hover:bg-black/60"
						>
							Cancel
						</button>
						<button
							onClick={onRename}
							disabled={saving || deleting || !newTitle.trim()}
							className="rounded-md bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-700 disabled:opacity-60"
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
