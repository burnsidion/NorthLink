import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Login – NorthLink",
	description: "Sign into your NorthLink account.",
};

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
