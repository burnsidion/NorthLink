import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";

export class InvalidProductUrl extends Error {}
export const PAGE_BYTE_LIMIT = 2 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
export type Address = { address: string; family: 4 | 6 };
export type PageResponse = { status: number; location?: string; html?: string };
export type PageReader = (url: URL, address: Address, signal: AbortSignal) => Promise<PageResponse>;
export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

/** Literal addresses, credentials and unusual ports are unnecessary for shop links. */
export function productUrl(input: string, base?: URL): URL {
 if (!input.trim() || input.length > 2048 || /[\u0000-\u0020\u007f]/.test(input)) throw new InvalidProductUrl();
 let url: URL;
 try { url = new URL(input, base); } catch { throw new InvalidProductUrl(); }
 const host = url.hostname.toLowerCase().replace(/\.$/, "");
 if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
  isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") ||
  /(?:^|\.)(?:localhost|local|internal)$/.test(host)) throw new InvalidProductUrl();
 url.hash = "";
 return url;
}

export function publicAddress(address: string): boolean {
 try {
  const parsed = ipaddr.parse(address);
  return parsed.range() === "unicast" &&
   (parsed.kind() === "ipv4" || ipaddr.IPv6.isValid(address) &&
    ipaddr.IPv6.parse(address).match(ipaddr.IPv6.parse("2000::"), 3));
 } catch { return false; }
}

/** Pin the vetted DNS answer to the connection; do not resolve the name again. */
export async function resolvePublicAddress(hostname: string, signal: AbortSignal,
 resolve: Resolver = host => lookup(host, { all: true, verbatim: true })): Promise<Address> {
 const answers = await abortable(resolve(hostname), signal);
 if (!answers.length || answers.length > 32 || answers.some(answer =>
  ![4, 6].includes(answer.family) || !publicAddress(answer.address))) throw new InvalidProductUrl();
 const answer = answers.find(answer => answer.family === 4) ?? answers[0];
 return { address: answer.address, family: answer.family as 4 | 6 };
}

export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
 return new Promise((resolve, reject) => {
  const abort = () => reject(new Error("Lookup stopped"));
  if (signal.aborted) { void work.catch(() => {}); abort(); return; }
  signal.addEventListener("abort", abort, { once: true });
  work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
 });
}

export const readPage: PageReader = (url, address, signal) => new Promise((resolve, reject) => {
 const request = url.protocol === "https:" ? httpsRequest : httpRequest;
 const req = request(url, {
  signal, agent: false, maxHeaderSize: 16_384,
  // Host header, SNI and certificate checks continue to use the original URL.
  lookup: (_hostname, options, callback) => {
   if (options.all) callback(null, [address]);
   else callback(null, address.address, address.family);
  },
  headers: {
   "User-Agent": "CyberSanta/1.0 (product details lookup)",
   Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity",
  },
 }, response => {
  const status = response.statusCode ?? 0;
  if ([301, 302, 303, 307, 308].includes(status)) {
   const location = response.headers.location;
   response.destroy(); resolve({ status, location }); return;
  }
  const type = response.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (status !== 200 || !["text/html", "application/xhtml+xml"].includes(type ?? "") ||
   (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") ||
   Number(response.headers["content-length"] ?? 0) > PAGE_BYTE_LIMIT) {
   response.destroy(); reject(new Error("Page unavailable")); return;
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  response.on("data", (chunk: Buffer) => {
   bytes += chunk.length;
   if (bytes > PAGE_BYTE_LIMIT) {
    response.destroy(); req.destroy(); reject(new Error("Page too large")); return;
   }
   chunks.push(chunk);
  });
  response.on("error", reject);
  response.on("aborted", () => reject(new Error("Page interrupted")));
  response.on("end", () => resolve({ status, html: Buffer.concat(chunks).toString("utf8") }));
 });
 req.on("error", reject);
 req.end();
});

/** One deadline covers DNS, every redirect and the complete response body. */
export async function fetchProductPage(input: string, options: {
 resolve?: Resolver; read?: PageReader; signal?: AbortSignal;
} = {}): Promise<{ html: string; url: URL }> {
 let url = productUrl(input);
 const signal = options.signal ?? AbortSignal.timeout(TIMEOUT_MS);
 for (let redirects = 0; redirects <= 3; redirects++) {
  const address = await resolvePublicAddress(url.hostname, signal, options.resolve);
  const page = await abortable((options.read ?? readPage)(url, address, signal), signal);
  if (page.html !== undefined) {
   if (Buffer.byteLength(page.html) > PAGE_BYTE_LIMIT) throw new Error("Page too large");
   return { html: page.html, url };
  }
  if (!page.location || redirects === 3) throw new Error("Too many redirects");
  const next = productUrl(page.location, url);
  if (url.protocol === "https:" && next.protocol !== "https:") throw new InvalidProductUrl();
  url = next;
 }
 throw new Error("Page unavailable");
}
