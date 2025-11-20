import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
	try {
		const { error } = await supabase.auth.signOut();

		if (error) {
			console.error("Error signing out:", error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		// Redirect to login page after successful logout
		return NextResponse.redirect(
			new URL(
				"/login",
				process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
			)
		);
	} catch (err) {
		console.error("Unexpected error during logout:", err);
		return NextResponse.json(
			{ error: "An unexpected error occurred" },
			{ status: 500 }
		);
	}
}
