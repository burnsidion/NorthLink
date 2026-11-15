import type { CSSProperties } from "react";

// Deterministic positions keep server and browser output identical.
const flakes = Array.from({ length: 24 }, (_, index) => ({
	left: `${(index * 37 + 11) % 100}%`,
	"--snow-delay": `${-(index * 3.7)}s`,
	"--snow-duration": `${24 + index % 9 * 3}s`,
	"--snow-size": `${2 + index % 3}px`,
} as CSSProperties));

export function LedgerBackground() {
	return (
		<div className="ledger-background" aria-hidden="true">
			{flakes.map((style, index) => <span key={index} style={style} />)}
		</div>
	);
}
