import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";

const fredoka = Fredoka({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	variable: "--font-fredoka",
});

export const metadata: Metadata = {
	metadataBase: new URL("https://north-link-swart.vercel.app"),
	title: "NorthLink – Shared Family Gift Lists",
	description:
		"Create, share, and track family Christmas lists with zero spoilers.",
	icons: {
		icon: "/favicon.ico",
	},
	openGraph: {
		title: "NorthLink – Shared Family Gift Lists",
		description: "Keep surprises secret while sharing your holiday gift ideas.",
		url: "https://north-link-swart.vercel.app",
		siteName: "NorthLink",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
			},
		],
		locale: "en_US",
		type: "website",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning className={fredoka.variable}>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
