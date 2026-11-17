import { supabase } from "@/lib/supabase";

export type BuyerRevealItem = {
 item_id: string;
 purchased_at: string | null;
 reveal_at: string | null;
 revealed: boolean;
 buyer_name: string | null;
};
export type ListBuyerReveal = {
 server_time: string;
 timezone: "America/New_York";
 items: BuyerRevealItem[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const message = "Buyer details couldn’t be loaded. Please try again.";

/** Preserve Postgres microseconds when matching the same claim across JSON formats. */
export function purchaseTimestampKey(value: unknown): string | null {
 if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
 const ms = Date.parse(value);
 if (!Number.isFinite(ms)) return null;
 const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/i)?.[1] ?? "";
 return `${ms}:${fraction.padEnd(6, "0").slice(3)}`;
}

export function parseBuyerReveal(value: unknown): ListBuyerReveal {
 if (!value || typeof value !== "object") throw new Error(message);
 const response = value as Record<string, unknown>;
 if (!purchaseTimestampKey(response.server_time) || response.timezone !== "America/New_York" || !Array.isArray(response.items)) throw new Error(message);
 const serverTime = Date.parse(response.server_time as string);
 const ids = new Set<string>();
 const items = response.items.map((value: unknown): BuyerRevealItem => {
  if (!value || typeof value !== "object") throw new Error(message);
  const row = value as Record<string, unknown>;
  if (typeof row.item_id !== "string" || !uuid.test(row.item_id) || ids.has(row.item_id) ||
   !(row.purchased_at === null || purchaseTimestampKey(row.purchased_at)) ||
   !(row.reveal_at === null || purchaseTimestampKey(row.reveal_at)) || typeof row.revealed !== "boolean") throw new Error(message);
  ids.add(row.item_id);
  if (row.revealed) {
   if (typeof row.buyer_name !== "string" || !row.buyer_name.trim() ||
    !row.purchased_at || !row.reveal_at || Date.parse(row.purchased_at as string) > serverTime || Date.parse(row.reveal_at as string) > serverTime) throw new Error(message);
  } else if (row.buyer_name !== null) throw new Error(message);
  // Never carry extra identity fields from the response into client state.
  return { item_id: row.item_id, purchased_at: row.purchased_at as string | null,
   reveal_at: row.reveal_at as string | null, revealed: row.revealed, buyer_name: row.buyer_name as string | null };
 });
 return { server_time: response.server_time as string, timezone: "America/New_York", items };
}

export async function getListBuyerReveal(listId: string, signal: AbortSignal): Promise<ListBuyerReveal> {
 if (!uuid.test(listId)) throw new Error(message);
 if (signal.aborted) throw new DOMException("Request canceled", "AbortError");
 const { data, error } = await supabase.rpc("get_list_buyer_reveal", { p_list_id: listId }).abortSignal(signal);
 if (signal.aborted) throw new DOMException("Request canceled", "AbortError");
 if (error) throw new Error(message);
 return parseBuyerReveal(data);
}
