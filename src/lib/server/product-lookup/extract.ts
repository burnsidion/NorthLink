import { Parser } from "htmlparser2";
import type { ProductDetails, ProductLookupResult } from "@/types/product-lookup";
import { toCents } from "@/lib/format";
import { productUrl } from "./safe-page";

type JsonObject = Record<string, unknown>;
const object = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, limit = 120): string | null => typeof value === "string"
 ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit) || null : null;
const hasType = (value: JsonObject, type: string) => [value["@type"]].flat().some(name =>
 typeof name === "string" && (name === type || name === `https://schema.org/${type}` || name === `http://schema.org/${type}`));

/** Keep structured price/currency paired. Ranges and competing offers are not a price. */
function price(value: unknown): number | null {
 if (!object(value) || !hasType(value, "Offer")) return null;
 let offer = value;
 if (offer.price === undefined && object(offer.priceSpecification)) offer = offer.priceSpecification;
 if (offer.priceCurrency !== "USD" || !["string", "number"].includes(typeof offer.price)) return null;
 const raw = String(offer.price).trim();
 if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null;
 try { return toCents(raw); } catch { return null; }
}

function image(value: unknown, base: URL): string | null {
 if (Array.isArray(value)) return image(value[0], base);
 if (object(value)) return image(value.contentUrl ?? value.url, base);
 if (typeof value !== "string" || !value.trim()) return null;
 try {
  const url = productUrl(value.trim(), base);
  // No image request here. Before persistence/rendering, checkpoint 3 owns image handling.
  return url.protocol === "https:" ? url.href : null;
 } catch { return null; }
}

export const unavailable = (): ProductLookupResult => ({
 status: "unavailable", details: { title: null, imageUrl: null, priceCents: null, currency: null },
});

/** Parse inert HTML metadata only. Never execute shop scripts or import notes. */
export function extractProduct(html: string, url: URL): ProductLookupResult {
 const meta = new Map<string, string>();
 const scripts: string[] = [];
 let title = "", script = "", inTitle = false, inJson = false;
 const parser = new Parser({
  onopentag(name, attributes) {
   if (name === "meta") {
    const key = (attributes.property ?? attributes.name ?? "").toLowerCase();
    if (key && attributes.content && !meta.has(key)) meta.set(key, attributes.content);
   }
   if (name === "title") inTitle = true;
   if (name === "script") {
    inJson = attributes.type?.toLowerCase() === "application/ld+json" && scripts.length < 20;
    script = "";
   }
  },
  ontext(value) {
   if (inTitle && title.length < 1024) title += value.slice(0, 1024 - title.length);
   if (inJson && script.length <= 262144) script += value;
  },
  onclosetag(name) {
   if (name === "title") inTitle = false;
   if (name === "script") {
    if (inJson && script.length <= 262144) scripts.push(script);
    inJson = false; script = "";
   }
  },
 }, { decodeEntities: true });
 parser.end(html);

 const products: JsonObject[] = [];
 let visited = 0;
 for (const source of scripts) {
  let root: unknown;
  try { root = JSON.parse(source); } catch { continue; }
  const stack = [root];
  while (stack.length && visited++ < 5000) {
   const node = stack.pop();
   if (Array.isArray(node)) stack.push(...node.slice(0, 5000));
   else if (object(node)) {
    if (hasType(node, "Product")) products.push(node);
    // Graph/mainEntity nesting is common; do not select an arbitrary product from a collection.
    stack.push(...Object.values(node).filter(child => child !== null && typeof child === "object").slice(0, 5000));
   }
  }
 }
 const product = visited <= 5000 && products.length === 1 ? products[0] : undefined;
 const name = text(product?.name) ?? text(meta.get("og:title")) ?? text(meta.get("twitter:title")) ?? text(title);
 if (name && /(?:access denied|robot check|captcha|just a moment|verify (?:you are|you're)|are you a robot|security check)/i.test(name)) return unavailable();
 if (!product && name?.toLowerCase().replace(/^www\./, "") === url.hostname.toLowerCase().replace(/^www\./, "")) return unavailable();
 const imageUrl = image(product?.image, url) ?? image(meta.get("og:image:secure_url") ?? meta.get("og:image"), url) ?? image(meta.get("twitter:image"), url);
 const offers = product?.offers;
 const singleOffer = Array.isArray(offers) ? offers.length === 1 ? offers[0] : undefined : offers;
 // Explicit page price tags can describe the selected variant of a ProductGroup.
 // Keep each amount paired with its own currency, never a scraped dollar sign.
 const pagePrice = (prefix: string) => price({ "@type": "Offer",
  price: meta.get(`${prefix}:amount`), priceCurrency: meta.get(`${prefix}:currency`) });
 const priceCents = pagePrice("product:price") ?? pagePrice("og:price") ?? price(singleOffer);
 const details: ProductDetails = { title: name, imageUrl, priceCents, currency: priceCents === null ? null : "USD" };
 return { status: name && imageUrl ? "ready" : name || imageUrl || priceCents !== null ? "partial" : "unavailable", details };
}
