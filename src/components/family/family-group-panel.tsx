"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
	Users,
	Copy,
	UserPlus,
	Plus,
	ChevronDown,
	ChevronUp,
} from "lucide-react";

type GroupMembership = {
	group_id: string;
	group_name: string;
	role: string;
};

export default function FamilyGroupPanel() {
	const [loading, setLoading] = useState(true);
	const [membership, setMembership] = useState<GroupMembership | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);

	// Create group state
	const [groupName, setGroupName] = useState("");
	const [creating, setCreating] = useState(false);

	// Join group state
	const [inviteCode, setInviteCode] = useState("");
	const [joining, setJoining] = useState(false);

	useEffect(() => {
		fetchMembership();
	}, []);

	async function fetchMembership() {
		try {
			const {
				data: { user },
				error: userErr,
			} = await supabase.auth.getUser();

			if (userErr || !user) {
				setLoading(false);
				return;
			}

			setUserId(user.id);

			// Query group_members with join to groups
			const { data, error } = await supabase
				.from("group_members")
				.select("group_id, role, groups(name, invite_code)")
				.eq("user_id", user.id)
				.limit(1)
				.maybeSingle();

			if (error) {
				console.error("Error fetching group membership:", error);
			} else if (data && data.groups) {
				setMembership({
					group_id: data.group_id,
					group_name: (data.groups as any).name,
					role: data.role,
				});
			}
		} catch (err) {
			console.error("Failed to fetch membership:", err);
		} finally {
			setLoading(false);
		}
	}

	async function handleCreateGroup() {
		if (!userId) return;

		const name = groupName.trim() || "My Family";
		setCreating(true);

		try {
			// Use RPC function to create group with invite code
			const { data: newGroup, error: groupErr } = await supabase.rpc(
				"create_group_with_code",
				{ p_name: name }
			);

			if (groupErr) throw groupErr;

			toast.success("Family group created!");
			setGroupName("");
			await fetchMembership();
		} catch (err: any) {
			console.error("Error creating group:", err);
			toast.error(err?.message || "Failed to create group");
		} finally {
			setCreating(false);
		}
	}

	async function handleJoinGroup() {
		if (!userId) return;

		const code = inviteCode.trim();
		if (!code) {
			toast.error("Please enter an invite code");
			return;
		}

		setJoining(true);

		try {
			const { error } = await supabase.from("group_members").insert({
				group_id: code,
				user_id: userId,
				role: "member",
			});

			if (error) throw error;

			toast.success("Joined family group!");
			setInviteCode("");
			await fetchMembership();
		} catch (err: any) {
			console.error("Error joining group:", err);
			toast.error(err?.message || "Invalid invite code or already a member");
		} finally {
			setJoining(false);
		}
	}

	async function handleCopyInviteCode() {
		if (!membership) return;

		try {
			await navigator.clipboard.writeText(membership.group_id);
			toast.success("Invite code copied to clipboard!");
		} catch (err) {
			toast.error("Failed to copy invite code");
		}
	}

	if (loading) {
		return (
			<div className="w-full max-w-2xl mx-auto mb-8">
				<div className="rounded-xl bg-gradient-to-br from-emerald-900/20 to-emerald-950/10 border border-emerald-700/30 p-6">
					<div className="animate-pulse space-y-3">
						<div className="h-6 w-32 bg-white/10 rounded" />
						<div className="h-4 w-48 bg-white/10 rounded" />
					</div>
				</div>
			</div>
		);
	}

	// User is in a group
	if (membership) {
		return (
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
				className="w-full max-w-2xl mx-auto mb-8"
			>
				<div className="rounded-xl bg-gradient-to-br from-emerald-900/20 to-emerald-950/10 border border-emerald-700/30 backdrop-blur-sm overflow-hidden">
					{/* Collapsible Header */}
					<button
						onClick={() => setIsExpanded(!isExpanded)}
						className="w-full p-4 flex items-center justify-between hover:bg-emerald-700/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
					>
						<div className="flex items-center gap-3">
							<div className="flex-shrink-0 p-2 bg-emerald-700/20 rounded-lg">
								<Users className="w-5 h-5 text-emerald-400" />
							</div>
							<div className="text-left">
								<h3 className="text-sm font-semibold text-white">
									Family Group
								</h3>
								<p className="text-lg font-bold text-emerald-300">
									{membership.group_name}
								</p>
							</div>
						</div>
						<div className="flex-shrink-0">
							{isExpanded ? (
								<ChevronUp className="w-5 h-5 text-emerald-400" />
							) : (
								<ChevronDown className="w-5 h-5 text-emerald-400" />
							)}
						</div>
					</button>

					{/* Expandable Content */}
					<AnimatePresence>
						{isExpanded && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="overflow-hidden"
							>
								<div className="px-6 pb-6 pt-2 border-t border-emerald-700/20">
									<div className="space-y-2">
										<p className="text-sm text-white/60">
											Share this code with your family so they can join your
											group:
										</p>
										<div className="flex items-center gap-2">
											<code className="flex-1 px-3 py-2 bg-black/30 rounded border border-white/10 text-xs font-mono text-white/80 break-all">
												{membership.group_id}
											</code>
											<button
												onClick={handleCopyInviteCode}
												className="flex-shrink-0 p-2 bg-emerald-700/60 hover:bg-emerald-700 rounded border border-emerald-600/50 text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
												title="Copy invite code"
											>
												<Copy className="w-4 h-4" />
											</button>
										</div>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</motion.div>
		);
	}

	// User is not in a group
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="w-full max-w-2xl mx-auto mb-8"
		>
			<div className="rounded-xl bg-gradient-to-br from-red-900/20 to-red-950/10 border border-red-700/30 p-6 backdrop-blur-sm">
				<div className="flex items-start gap-4 mb-6">
					<div className="flex-shrink-0 p-3 bg-red-700/20 rounded-lg">
						<Users className="w-6 h-6 text-red-400" />
					</div>
					<div className="flex-1">
						<h3 className="text-lg font-semibold text-white mb-1">
							Join Your Family
						</h3>
						<p className="text-sm text-white/60">
							Create a new family group or join an existing one
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* Create Group */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-white/80 mb-2">
							<Plus className="w-4 h-4" />
							<h4 className="font-medium text-sm">Create Family Group</h4>
						</div>
						<input
							type="text"
							placeholder="Burnside Family"
							value={groupName}
							onChange={(e) => setGroupName(e.target.value)}
							className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-sm"
							disabled={creating}
						/>
						<button
							onClick={handleCreateGroup}
							disabled={creating}
							className="w-full px-4 py-2 bg-red-700/60 hover:bg-red-700 text-white rounded font-medium text-sm border border-red-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
						>
							{creating ? "Creating..." : "Create family group"}
						</button>
					</div>

					{/* Join Group */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-white/80 mb-2">
							<UserPlus className="w-4 h-4" />
							<h4 className="font-medium text-sm">Join Existing Group</h4>
						</div>
						<input
							type="text"
							placeholder="Enter invite code"
							value={inviteCode}
							onChange={(e) => setInviteCode(e.target.value)}
							className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded text-white placeholder:text-white/40 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-sm font-mono"
							disabled={joining}
						/>
						<button
							onClick={handleJoinGroup}
							disabled={joining || !inviteCode.trim()}
							className="w-full px-4 py-2 bg-red-700/60 hover:bg-red-700 text-white rounded font-medium text-sm border border-red-600/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
						>
							{joining ? "Joining..." : "Join family group"}
						</button>
					</div>
				</div>
			</div>
		</motion.div>
	);
}
