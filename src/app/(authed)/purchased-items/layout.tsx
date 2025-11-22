import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "My Purchases – CyberSanta",
	description: "See the items you've marked as purchased.",
};

export default function PurchasedItemsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
