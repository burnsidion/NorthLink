import type { ProductLookupResult } from "@/types/product-lookup";
import { extractProduct, unavailable } from "./extract";
import { fetchProductPage, InvalidProductUrl } from "./safe-page";

/** No persistence and no retailer-specific bypasses: blocked shops fall back to manual entry. */
export async function lookupProduct(url: string): Promise<ProductLookupResult> {
 try {
  const page = await fetchProductPage(url);
  return extractProduct(page.html, page.url);
 } catch (error) {
  if (error instanceof InvalidProductUrl) throw error;
  return unavailable();
 }
}
