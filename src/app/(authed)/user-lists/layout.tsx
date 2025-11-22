import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "My Lists – CyberSanta",
	description: "Create and manage your personal gift lists.",
};

export default function UserListsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
