import type { Metadata } from "next";
import { Geist, Fredoka } from "next/font/google";
import "./globals.css";
import { LedgerMotion } from "@/components/brand/ledger-motion";
import { LedgerBackground } from "@/components/brand/ledger-background";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const ledgerSans = Geist({ subsets: ["latin"], variable: "--font-ledger-sans", display: "swap" });

const fredoka = Fredoka({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	variable: "--font-fredoka",
});

export const metadata: Metadata = {
	metadataBase: new URL("https://north-link-swart.vercel.app"),
	title: "CyberSanta – Shared Family Gift Lists",
	description:
		"Create, share, and track family Christmas lists with zero spoilers.",
	icons: {
		icon: { url: "/brand/cybersanta-seal.svg", type: "image/svg+xml" },
	},
	openGraph: {
		title: "CyberSanta – Shared Family Gift Lists",
		description: "Keep surprises secret while sharing your holiday gift ideas.",
		url: "https://north-link-swart.vercel.app",
		siteName: "CyberSanta",
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
		<html lang="en" suppressHydrationWarning className={`${fredoka.variable} ${ledgerSans.variable}`}>
			<body>
                <LedgerBackground />
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					<LedgerMotion>{children}</LedgerMotion>
					<Toaster richColors />
				</ThemeProvider>
			</body>
		</html>
	);
}
