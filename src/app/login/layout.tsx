import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Login – CyberSanta",
	description: "Sign into your CyberSanta account.",
};

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
