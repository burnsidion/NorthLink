"use client";
import { useState } from "react";
import { itemImageUrl } from "@/lib/item-image";
// Use a direct image: arbitrary retailer hosts must not become server-side optimizer fetches.
/* eslint-disable @next/next/no-img-element */
export default function ItemThumbnail({ src }: { src?: string | null }) {
 const url = itemImageUrl(src);
 const [failed, setFailed] = useState<string | null>(null);
 return <span className="ledger-item-thumbnail" aria-hidden="true">
  {url && failed !== url ? <img src={url} alt="" width={48} height={48} loading="lazy" decoding="async"
   referrerPolicy="no-referrer" onError={() => setFailed(url)} /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 10h16v4H4zM6 14v7h12v-7M12 10v11M12 10C4 10 5 3 8 4c3 0 4 6 4 6Zm0 0c8 0 7-7 4-6-3 0-4 6-4 6Z" /></svg>}
 </span>;
}
