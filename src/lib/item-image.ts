/** Remote thumbnails are optional HTTPS images, never a server-side proxy request. */
export function itemImageUrl(value: unknown): string | null {
 if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
 try {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
   !host.includes(".") || host.includes(":") || /^[\d.]+$/.test(host) ||
   /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) || host.endsWith(".")) return null;
  return url.href.length <= 2048 ? url.href : null;
 } catch { return null; }
}
export function validateItemImage(value: unknown): string | null {
 if (value == null || value === "") return null;
 const url = itemImageUrl(value);
 if (!url) throw new Error("This thumbnail link is invalid. Remove it before saving.");
 return url;
}
