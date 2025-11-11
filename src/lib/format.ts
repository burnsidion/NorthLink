export const toCents = (v: string) => {
	const n = Number(v.replace(/[^0-9.]/g, ""));
	return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export const normalizeUrl = (v: string) => {
	if (!v.trim()) return null;
	try {
		const u = new URL(v.match(/^https?:\/\//) ? v : "https://" + v);
		return u.toString();
	} catch {
		return null;
	}
};

export const usd = new Intl.NumberFormat(undefined, {
	style: "currency",
	currency: "USD",
});
