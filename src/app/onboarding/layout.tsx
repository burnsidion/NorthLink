import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Onboarding – CyberSanta",
	description: "Set up your CyberSanta profile.",
};

export default function OnboardingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
