"use client";

export function RefreshNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
	return (
		<div role="alert" className="my-4 space-y-2 rounded-lg border border-amber-600/50 bg-black/70 p-4 text-white">
			<p>{message}</p>
			<button onClick={onRetry} className="underline">Try again</button>
		</div>
	);
}
