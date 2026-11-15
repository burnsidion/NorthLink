/** Blank means unknown; accept nonnegative dollars with at most two decimals. */
export const toCents = (value: string): number | null => {
	const text = value.trim();
	if (!text) return null;
	if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Enter a price like 24.99, or leave it blank.");
	const [dollars, fraction = ""] = text.split(".");
	const cents = Number(dollars) * 100 + Number(fraction.padEnd(2, "0"));
	return validatePriceCents(cents);
};

export function validatePriceCents(value: number | null): number | null {
	if (value === null) return null;
	if (!Number.isInteger(value) || value < 0 || value > 2147483647) {
		throw new Error("Price must be a nonnegative amount no greater than 21,474,836.47.");
	}
	return value;
}

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
