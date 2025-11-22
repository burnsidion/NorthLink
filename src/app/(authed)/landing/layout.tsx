import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Landing – CyberSanta",
	description: "View your lists, notifications, and family status.",
};

export default function LandingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
