"use client";
import { WreathLoader } from "@/components/ui/wreath-loader";
//Deps
import { useState, useEffect, useRef } from "react";
import { getListsWithProgress } from "@/lib/list-progress";
import { useRefreshingData } from "@/lib/use-refreshing-data";
import { RefreshNotice } from "@/components/ui/refresh-notice";
import { toast } from "sonner";
import { renameList, deleteList } from "@/lib/lists-api";

import CreateListButton from "@/components/ui/create-list-button";
import { ManageListModal } from "@/components/ui/manage-list-modal";
import ListCard from "@/components/lists/list-card";
import CountdownBanner from "@/components/ui/countdown-banner";

const loadLists = () => getListsWithProgress(false);

export default function UserListsPage() {
	const { data: lists, error, loading, retry, updateData: setLists } = useRefreshingData(loadLists, "my-lists-progress");
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

	const rows = lists ?? [];

	return (
		<main className="ledger-theme ledger-paper ledger-page ledger-page-arrival">
			<header className="ledger-page-heading">
				<div>
					<p className="ledger-eyebrow">A little Christmas magic</p>
					<h1 className="ledger-title">My Lists</h1>
					<CountdownBanner appearance="ledger" />
				</div>
				{!loading && lists !== null && <CreateListButton onCreated={newList => {
					setLists(previous => [{ ...newList, total: 0, purchased: 0 }, ...(previous ?? [])]);
					retry();
				}} />}
			</header>
			<div className="ledger-rule" aria-hidden="true">✦</div>
			{error && <RefreshNotice message={error} onRetry={retry} />}
			{loading ? (
				<section aria-label="Loading lists" aria-busy="true">
                    <WreathLoader label="Loading your lists…" className="ledger-list-loading-status" />
                    <div className="grid gap-6 sm:grid-cols-2" aria-hidden="true">{[0, 1, 2, 3].map(index => <div key={index} className="ledger-loading-card"><div className="ledger-loading-line"/><div className="ledger-loading-line" style={{ width: "40%" }}/></div>)}</div>
				</section>
			) : lists === null ? null : rows.length === 0 ? (
				<section className="ledger-empty">
					<h2>Your Christmas story starts here</h2>
					<p>Create your first list, then fill it with a few things you’d love.</p>
				</section>
			) : (
				<section className="ledger-scroll-stack ledger-content-arrival" aria-label="Your wish lists">
					{rows.map((list, index) => <ListCard key={list.id} list={list} index={index} onManage={(id, title) => {
						if (actionPending.current) return;
						setActionError(null);
						setManageList({ id, title });
						setNewTitle(title);
						setIsModalOpen(true);
					}} />)}
				</section>
			) }
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
		</main>
	);
}
