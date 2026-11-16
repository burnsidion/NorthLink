import Image from "next/image";
import Link from "next/link";

export function CyberSantaBrand({ compact = false }: { compact?: boolean }) {
	return (
		<Link href="/landing" className="ledger-brand" aria-label="CyberSanta home">
			<Image src="/brand/cybersanta-seal.svg" alt="" width={compact ? 38 : 52} height={compact ? 38 : 52} />
			<span>CyberSanta</span>
		</Link>
	);
}
