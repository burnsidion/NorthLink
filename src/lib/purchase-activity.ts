import { supabase } from "@/lib/supabase";
import { getMyPurchases } from "@/lib/purchases-api";
import { calculateNewPurchases } from "@/lib/list-helpers";

export type PurchaseActivity = { id: string; title: string; count: number };
type ActivityList = {
 id: string; title: string; owner_user_id: string; last_viewed_at: string | null;
 items: { id: string; purchased: boolean; purchased_at: string | null }[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function summarizePurchaseActivity(lists: ActivityList[], selfPurchasedIds: Set<string>): PurchaseActivity[] {
 return lists.flatMap(list => {
  const count = calculateNewPurchases(list.items.filter(item => !selfPurchasedIds.has(item.id)), list.last_viewed_at);
  return count ? [{ id:list.id, title:list.title, count }] : [];
 });
}

/** Read only owner-visible status and the caller's own purchases; never other buyers. */
export async function getPurchaseActivity(userId: string): Promise<PurchaseActivity[]> {
 const [owned, ownPurchases] = await Promise.all([
  supabase.from("lists").select("id,title,owner_user_id,last_viewed_at,items(id,purchased,purchased_at)").eq("owner_user_id",userId),
  getMyPurchases(),
 ]);
 if (owned.error || !Array.isArray(owned.data)) throw new Error("Could not check purchase notifications.");
 const lists = owned.data as unknown[];
 const valid = lists.every(value => {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string,unknown>;
  return typeof row.id === "string" && uuid.test(row.id) && typeof row.title === "string" && row.owner_user_id === userId &&
   (row.last_viewed_at === null || typeof row.last_viewed_at === "string" && Number.isFinite(Date.parse(row.last_viewed_at))) &&
   Array.isArray(row.items) && row.items.every(item => item && typeof item.id === "string" && typeof item.purchased === "boolean" &&
    (item.purchased_at === null || typeof item.purchased_at === "string" && Number.isFinite(Date.parse(item.purchased_at))));
 });
 if (!valid) throw new Error("Could not check purchase notifications.");
 return summarizePurchaseActivity(lists as ActivityList[],new Set(ownPurchases.map(item => item.id)));
}
