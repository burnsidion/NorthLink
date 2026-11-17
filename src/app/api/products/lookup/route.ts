import { authenticateLookupUser } from "@/lib/server/product-lookup/auth";
import { createProductLookupHandler, makeLookupLimiter } from "@/lib/server/product-lookup/handler";
import { lookupProduct } from "@/lib/server/product-lookup/service";

export const runtime = "nodejs";
export const maxDuration = 15;
const handle = createProductLookupHandler({
 authenticate: authenticateLookupUser, lookup: lookupProduct, allow: makeLookupLimiter(),
});
export async function POST(request: Request) { return handle(request); }
