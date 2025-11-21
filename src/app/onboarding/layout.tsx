import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Onboarding – NorthLink",
	description: "Set up your NorthLink profile.",
};

export default function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
