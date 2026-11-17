"use client";
import { supabase } from "@/lib/supabase";
import { normalizeUrl, safeWebUrl } from "@/lib/format";
import type { ProductLookupResult } from "@/types/product-lookup";

const manualFallback = "Couldn’t read this link. You can enter the details manually or try again.";

/** Treat the API response as untrusted, including nullable and partial suggestions. */
export function isProductLookupResult(value: unknown): value is ProductLookupResult {
 if (!value || typeof value !== "object") return false;
 const row = value as Record<string, unknown>;
 if (typeof row.status !== "string" || !["ready", "partial", "unavailable"].includes(row.status) || !row.details || typeof row.details !== "object") return false;
 const details = row.details as Record<string, unknown>;
 const validTitle = details.title === null || typeof details.title === "string" && details.title.trim().length > 0 && details.title.length <= 120;
 const validImage = details.imageUrl === null || typeof details.imageUrl === "string" &&
  details.imageUrl.length <= 2048 && details.imageUrl.startsWith("https://") && safeWebUrl(details.imageUrl) !== null;
 const validPrice = details.priceCents === null ? details.currency === null :
  typeof details.priceCents === "number" && Number.isInteger(details.priceCents) &&
  details.priceCents >= 0 && details.priceCents <= 2147483647 && details.currency === "USD";
 if (!validTitle || !validImage || !validPrice) return false;
 const any = details.title !== null || details.imageUrl !== null || details.priceCents !== null;
 return row.status === "unavailable" ? !any : row.status === "ready"
  ? details.title !== null && details.imageUrl !== null : any;
}

/** One explicit lookup using the current browser session; never save or fetch images here. */
export async function getProductSuggestions(input: string, signal: AbortSignal): Promise<ProductLookupResult> {
 const pasted = input.trim();
 const url = /^https?:\/\//i.test(pasted) ? safeWebUrl(pasted) : normalizeUrl(pasted);
 if (!url || !safeWebUrl(url)) throw new Error("Enter a product’s web link, or add the details manually.");
 let session;
 try { session = await supabase.auth.getSession(); }
 catch { throw new Error("Please sign in again to fill from a link. Your entries are still here."); }
 const { data, error } = session;
 if (signal.aborted) throw new DOMException("Lookup canceled", "AbortError");
 if (error || !data.session?.access_token) throw new Error("Please sign in again to fill from a link. Your entries are still here.");
 let response: Response;
 try {
  response = await fetch("/api/products/lookup", {
   method: "POST", signal, cache: "no-store",
   headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
   body: JSON.stringify({ url }),
  });
 } catch (error) {
  if (signal.aborted) throw error;
  throw new Error(manualFallback);
 }
 if (response.status === 401) throw new Error("Please sign in again to fill from a link. Your entries are still here.");
 if (response.status === 429) throw new Error("Please wait a minute before trying another lookup. You can still enter details manually.");
 if (!response.ok) throw new Error(manualFallback);
 let result: unknown;
 try { result = await response.json(); } catch { throw new Error(manualFallback); }
 if (!isProductLookupResult(result)) throw new Error(manualFallback);
 return result;
}
