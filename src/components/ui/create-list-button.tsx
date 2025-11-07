"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { supabase } from "@/lib/supabase";

export default function CreateListButton() {
	const router = useRouter();
	const [pending, start] = useTransition();

	async function onClick() {
		const title = window.prompt("Name your new list:");
		if (!title?.trim()) return;

		start(async () => {
			const { error } = await supabase
				.from("lists")
				.insert({ title: title.trim() });
			if (!error) router.refresh(); // re-renders /user-lists
			// (optional) toast error if you want
		});
	}

	return (
		<button
			onClick={onClick}
			aria-busy={pending}
			disabled={pending}
			className="relative inline-flex h-12 overflow-hidden rounded-full p-px focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
		>
			<span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#FF0000_0%,#008000_50%,#FFFFFF_100%)]" />
			<span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-3 py-1 text-sm font-medium text-white backdrop-blur-3xl">
				Create New List
			</span>
		</button>
	);
}
