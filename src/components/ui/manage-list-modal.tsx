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
			className="ledger-theme ledger-dialog-backdrop fixed inset-0 z-100 flex items-center justify-center"
			role="dialog"
			aria-modal="true"
			aria-busy={saving || deleting}
			aria-label="Manage list"
			onClick={(e) => {
				if (!saving && !deleting && e.target === e.currentTarget) onClose();
			}}
		>
			<div className="ledger-paper ledger-dialog">
				<h3>Manage “{list.title}”</h3>

				<label
					className="block"
					htmlFor="list-title"
				>
					Rename
				</label>

				<input
					disabled={saving || deleting}
					id="list-title"
					type="text"
					className="ledger-input"
					value={newTitle}
					onChange={(e) => setNewTitle(e.target.value)}
				/>

				{error && <p role="alert" className="ledger-error">{error}</p>}
				<div className="ledger-dialog-actions">
					<button
						onClick={onDelete}
						disabled={saving || deleting}
						className="ledger-danger inline-flex items-center gap-2 mr-auto"
					>
						<DeleteOutlined /> {deleting ? "Deleting…" : "Delete"}
					</button>

					<div className="flex gap-2">
						<button
							onClick={onClose}
							disabled={saving || deleting}
							className="ledger-secondary"
						>
							Cancel
						</button>
						<button
							onClick={onRename}
							disabled={saving || deleting || !newTitle.trim()}
							className="ledger-button"
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
