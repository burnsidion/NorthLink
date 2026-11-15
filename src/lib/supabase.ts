"use client";

import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
	{
		auth: {
			// Sessions live in this browser; callback URLs must finish here too.
			flowType: "implicit",
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	}
);
