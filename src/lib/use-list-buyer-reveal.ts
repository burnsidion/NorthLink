"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ItemRow } from "@/types/db";
import { getListBuyerReveal, purchaseTimestampKey, type ListBuyerReveal } from "@/lib/buyer-reveal-api";

/** Only server-released names matching the current owner/list/claim can render. */
export function useListBuyerReveal({ listId, userId, items }: {
 listId: string; userId: string | null; items: ItemRow[];
}) {
 const purchases = items.filter(item => item.purchased);
 const scope = userId && purchases.length ? JSON.stringify([userId, listId,
  purchases.map(item => [item.id, purchaseTimestampKey(item.purchased_at)]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))]) : null;
 const [snapshot, setSnapshot] = useState<{scope: string; response: ListBuyerReveal} | null>(null);
 const [failure, setFailure] = useState<string | null>(null);
 const [pending, setPending] = useState<string | null>(null);
 const requestRefresh = useRef<() => void>(() => {});
 const retry = useCallback(() => requestRefresh.current(), []);
 useEffect(() => {
  if (!scope) { requestRefresh.current = () => {}; return; }
  let active = true, version = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const schedule = (delay = 30_000) => {
   clearTimeout(timer);
   timer = setTimeout(() => { void refresh(); }, delay);
  };
  const refresh = async () => {
   if (!active) return;
   if (document.visibilityState === "hidden") { schedule(); return; }
   const request = ++version;
   controller?.abort(); clearTimeout(timer); clearTimeout(timeout);
   const current = new AbortController(); controller = current;
   setPending(scope);
   timeout = setTimeout(() => {
    if (!active || request !== version) return;
    version++; current.abort(); setSnapshot(null); setFailure(scope); setPending(null); schedule();
   }, 12_000);
   let delay = 30_000;
   try {
    const response = await getListBuyerReveal(listId, current.signal);
    if (!active || request !== version || current.signal.aborted) return;
    setSnapshot({scope, response}); setFailure(null);
    // The browser schedules a recheck; only the next server response can reveal a name.
    const hidden = response.items.filter(item => !item.revealed && item.reveal_at);
    if (hidden.length) delay = Math.min(30_000, Math.max(500,
     Math.min(...hidden.map(item => Math.max(Date.parse(item.reveal_at!), Date.parse(item.purchased_at ?? item.reveal_at!)))) - Date.parse(response.server_time) + 150));
   } catch {
    if (!active || request !== version) return;
    setSnapshot(null); setFailure(scope);
   } finally {
    if (active && request === version) {
     clearTimeout(timeout); setPending(null); schedule(delay);
    }
   }
  };
  const visibleRefresh = () => { if (document.visibilityState !== "hidden") void refresh(); };
  requestRefresh.current = visibleRefresh;
  window.addEventListener("focus", visibleRefresh);
  window.addEventListener("online", visibleRefresh);
  document.addEventListener("visibilitychange", visibleRefresh);
  void refresh();
  return () => {
   active = false; version++; controller?.abort(); clearTimeout(timer); clearTimeout(timeout);
   requestRefresh.current = () => {};
   window.removeEventListener("focus", visibleRefresh);
   window.removeEventListener("online", visibleRefresh);
   document.removeEventListener("visibilitychange", visibleRefresh);
  };
 }, [scope, listId]);
 const response = snapshot?.scope === scope ? snapshot.response : null;
 const currentRows = purchases.flatMap(item => {
  const row = response?.items.find(row => row.item_id === item.id);
  const key = purchaseTimestampKey(item.purchased_at);
  return row && key && key === purchaseTimestampKey(row.purchased_at) ? [row] : [];
 });
 const names = new Map(currentRows.filter(row => row.revealed && row.buyer_name).map(row => [row.item_id, row.buyer_name!]));
 const nextRevealAt = currentRows.filter(row => !row.revealed && row.reveal_at).map(row => row.reveal_at!).sort((a,b) => Date.parse(a)-Date.parse(b))[0] ?? null;
 return { names, nextRevealAt, available: !!response, loading: !!scope && (pending === scope || (!response && failure !== scope)),
  error: !!scope && failure === scope, retry };
}
