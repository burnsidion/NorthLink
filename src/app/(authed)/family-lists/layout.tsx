import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Family Lists – CyberSanta",
	description: "Browse and interact with lists shared in your family group.",
};

export default function FamilyListsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
