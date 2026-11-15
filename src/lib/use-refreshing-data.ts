"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { supabase } from "@/lib/supabase";

let subscriptionNumber = 0;

/** Refresh read-only screen data; events carry no trusted application state. */
export function useRefreshingData<T>(load: () => Promise<T>, channelName: string) {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const version = useRef(0);
	const requestRefresh = useRef<() => void>(() => {});

	// A confirmed local action supersedes reads already in flight.
	const updateData = useCallback((update: SetStateAction<T | null>) => {
		version.current++;
		setData(update);
	}, []);
	const retry = useCallback(() => requestRefresh.current(), []);

	useEffect(() => {
		let active = true;
		const invalidate = () => { version.current++; };
		let debounce: ReturnType<typeof setTimeout> | undefined;
		const refresh = async () => {
			const request = ++version.current;
			try {
				const next = await load();
				if (!active || request !== version.current) return;
				setData(next);
				setError(null);
			} catch {
				if (active && request === version.current) setError("Couldn’t refresh this page. Any displayed totals may be out of date. Please try again.");
			} finally {
				if (active && request === version.current) setLoading(false);
			}
		};
		const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
		const schedule = () => {
			if (debounce !== undefined) clearTimeout(debounce);
			debounce = setTimeout(visibleRefresh, 150);
		};
		requestRefresh.current = () => { void refresh(); };
		void refresh();
		// Unique topics prevent a previous asynchronous unsubscribe from closing a new mount.
		const channel = supabase.channel(`${channelName}:${++subscriptionNumber}`)
			.on("postgres_changes", { event: "*", schema: "public", table: "items" }, schedule)
			.on("postgres_changes", { event: "*", schema: "public", table: "lists" }, schedule)
			.on("postgres_changes", { event: "*", schema: "public", table: "list_shares" }, schedule)
			.subscribe(status => { if (status === "SUBSCRIBED") schedule(); });
		window.addEventListener("focus", visibleRefresh);
		window.addEventListener("online", visibleRefresh);
		document.addEventListener("visibilitychange", visibleRefresh);
		const interval = setInterval(visibleRefresh, 30_000);
		return () => {
			active = false;
			invalidate();
			requestRefresh.current = () => {};
			if (debounce !== undefined) clearTimeout(debounce);
			clearInterval(interval);
			window.removeEventListener("focus", visibleRefresh);
			window.removeEventListener("online", visibleRefresh);
			document.removeEventListener("visibilitychange", visibleRefresh);
			void supabase.removeChannel(channel);
		};
	}, [load, channelName]);
	return { data, error, loading, retry, updateData };
}
