# OWL-67 checkpoint 1: product lookup foundation

## Scope

Implemented only the read-only lookup endpoint and extraction service. No form
integration, image requests, image persistence, database migration, hosted setting
change, commits, or publication are part of this checkpoint.

POST `/api/products/lookup` takes JSON `{ "url": "https://retailer.example/product" }`
and the browser's existing Supabase bearer token. No privileged credential is used.
Auth validates the token with Supabase and rejects anonymous sessions. The route is
thin; authentication, request handling, safe transport and parsing are separate.

Successful responses contain `status` (`ready`, `partial`, or `unavailable`) and
`details`: nullable `title`, `imageUrl`, `priceCents`, and `currency` (`USD` or null).
Ready means a name and image were found, not that every field or variant is correct.
Prices are one-time suggestions, not tracked. Notes are never scraped or changed.

## Safety and behavior

- Only explicit authenticated POST requests trigger retailer requests. Existing
  list views still make no automatic product lookup requests.
- No incoming cookies, bearer token, referrer, or other browser headers are sent
  to retailers. Only fixed metadata request headers are used.
- Reject credentials, literal IP URLs, local hostnames, unusual ports, and
  non-web schemes. Reject private/reserved/mixed DNS answers. Connect using the
  vetted address without resolving again, retaining hostname/TLS validation.
- Recheck each redirect; allow at most three and never downgrade HTTPS to HTTP.
- One eight-second deadline bounds DNS, redirects and response reading. Responses
  must be uncompressed HTML, with at most 2 MiB and bounded response headers.
- Parse standard Product JSON-LD and Open Graph/Twitter/title metadata without
  executing scripts. Limit structured-data size and traversal. Blocking pages,
  malformed pages, timeouts and missing fields allow manual-entry fallback.
- Import a price only with its paired USD currency. Competing/ranged structured
  offers stay blank unless the page supplies an explicit current-page price.
- Request bodies are limited to 4 KiB. Responses are private/no-store, and failure
  messages do not expose internal details, URLs or credentials.
- Throttle: ten requests per minute per authenticated user, with a bounded map.
  **This is per server process, not a durable/distributed quota.** Different
  serverless instances can allow additional requests. This avoids new hosted
  infrastructure for the family-scale first version; it is not a global abuse cap.

`imageUrl` remains untrusted external metadata. This checkpoint does not fetch it
or authorize using it as an unrestricted server proxy target. The thumbnail
checkpoint must define image validation/loading and fallback behavior before use.

## Validation

- `npm run check`: type checking and 114 passing tests, including 16 lookup tests.
- Targeted ESLint and `git diff --check` pass.
- Production build succeeds and emits a dynamic Node lookup route.
- Transport/auth tests cover private IPv4/IPv6, mixed DNS, rebinding resistance,
  redirect escape, deadlines, content/body limits, missing/expired/anonymous auth,
  rate limiting, extraction, ambiguous prices and recoverable retailer failures.

### Live sample checks (November 16, 2026)

The production transport/extractor was exercised directly against public product
pages, not private family gift links. These observations are not a guarantee of
store-wide coverage or behavior from Vercel's different network addresses.

| Sample | Result |
| --- | --- |
| [Target OXO grinder](https://www.target.com/p/-/A-54635218) | Name and image; price absent from readable metadata |
| [East Fork mug](https://eastfork.com/products/east-fork-mug?variant=42737648697423) | Name, image and explicit USD price (4,400 cents at the time) |
| [Amazon bundle](https://www.amazon.com/dp/B0HGHB3V16) | Blocking page; unavailable, not the generic Amazon.com title |
| [Etsy mug](https://www.etsy.com/listing/1492556764/handmade-personalized-ceramic-mug-custom) | Retailer refused the request; unavailable |
| [Best Buy AirPods](https://www.bestbuy.com/product/apple-airpods-4-with-active-noise-cancellation-white/JJGCQ832YX) | Timed out within the eight-second limit; unavailable |

A direct Shop product link is still needed for a representative Shop check. No
store-specific anti-bot bypass, paid provider, or browser automation was added.

## Review before continuing

1. Decide whether this best-effort coverage is sufficient for the first version.
2. Checkpoint 2: explicit Fill from link action, editable suggestions, cancellation
   and stale-response protection, manual fallback, and the price-fluctuation note.
3. Checkpoint 3: nullable saved thumbnail data and list/purchase thumbnails with
   graceful failure. Any hosted migration requires separate explicit approval.
