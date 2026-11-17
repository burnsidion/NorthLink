import type { ProductLookupResult } from "@/types/product-lookup";
import { abortable, InvalidProductUrl } from "./safe-page";

type Dependencies = {
 authenticate: (token: string) => Promise<string | null>;
 lookup: (url: string) => Promise<ProductLookupResult>;
 allow: (userId: string) => boolean;
};

/** Best-effort per-process throttle, bounded in memory. Not a distributed quota. */
export function makeLookupLimiter(now = Date.now) {
 const users = new Map<string, { expires: number; count: number }>();
 return (userId: string) => {
  const time = now();
  for (const [id, entry] of users) if (entry.expires <= time) users.delete(id);
  const current = users.get(userId);
  if (!current) {
   if (users.size >= 1000) return false;
   users.set(userId, { expires: time + 60_000, count: 1 }); return true;
  }
  if (current.count >= 10) return false;
  current.count++; return true;
 };
}

async function readInput(request: Request): Promise<string> {
 if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
  Number(request.headers.get("content-length") ?? 0) > 4096 || !request.body) throw new InvalidProductUrl();
 const reader = request.body.getReader();
 const chunks: Uint8Array[] = [];
 let length = 0;
 const signal = AbortSignal.timeout(5000);
 try {
  while (true) {
   const { value, done } = await abortable(reader.read(), signal);
   if (done) break;
   length += value.byteLength;
   if (length > 4096) throw new InvalidProductUrl();
   chunks.push(value);
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || typeof body !== "object" || !("url" in body) || typeof body.url !== "string") throw new InvalidProductUrl();
  return body.url.trim();
 } catch { throw new InvalidProductUrl(); }
 finally { void reader.cancel().catch(() => {}); }
}

const json = (body: unknown, status = 200) => Response.json(body, {
 status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
});

export function createProductLookupHandler(dependencies: Dependencies) {
 return async (request: Request): Promise<Response> => {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]{1,8192})$/i.exec(authorization);
  if (!match) return json({ error: "Please sign in to fill from a link." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Request not allowed." }, 403);
  let userId: string | null;
  try { userId = await dependencies.authenticate(match[1]); }
  catch { return json({ error: "Could not confirm your sign-in. Try again shortly." }, 503); }
  if (!userId) return json({ error: "Please sign in to fill from a link." }, 401);
  if (!dependencies.allow(userId)) return json({ error: "Please wait a minute before looking up more links." }, 429);
  try {
   const url = await readInput(request);
   return json(await dependencies.lookup(url));
  } catch (error) {
   if (error instanceof InvalidProductUrl) return json({ error: "Use a public product link starting with https:// or http://." }, 400);
   return json({ error: "Could not look up this product. You can still enter it manually." }, 502);
  }
 };
}
