/** Suggestions only: the user reviews these before saving a gift. */
export type ProductDetails = {
 title: string | null;
 imageUrl: string | null;
 priceCents: number | null;
 currency: "USD" | null;
};
export type ProductLookupResult = {
 status: "ready" | "partial" | "unavailable";
 details: ProductDetails;
};
