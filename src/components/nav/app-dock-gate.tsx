"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppDock from "./app-dock";

export default function AppDockGate() {
	const [show, setShow] = useState(false);

	useEffect(() => {
		let alive = true;

		(async () => {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!alive) return;
			setShow(!!user);
		})();

		const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
			setShow(!!session?.user);
		});

		return () => {
			alive = false;
			sub.subscription.unsubscribe();
		};
	}, []);

	if (!show) return null;
	return <AppDock />;
}
