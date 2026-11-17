"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { getProductSuggestions } from "@/lib/product-lookup-client";

import { itemImageUrl } from "@/lib/item-image";
type Inputs = {
 imageUrl: string | null; setImageUrl: Dispatch<SetStateAction<string | null>>;
 open: boolean; submitting?: boolean; title: string; price: string; link: string;
 setTitle: Dispatch<SetStateAction<string>>; setPrice: Dispatch<SetStateAction<string>>;
};
type Feedback = { kind: "success" | "error"; message: string } | null;

/** Suggest into untouched empty fields only; edits, cancellation and new requests win. */
export function useProductAutofill({ open, submitting, title, price, link, setTitle, setPrice, imageUrl, setImageUrl }: Inputs) {
 const [loading, setLoading] = useState(false);
 const [feedback, setFeedback] = useState<Feedback>(null);
 const active = useRef<AbortController | null>(null);
 const version = useRef(0);
 const edits = useRef({ title: 0, price: 0, image: 0 });
 const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
 const stop = useCallback(() => {
  version.current++;
  active.current?.abort(); active.current = null;
  clearTimeout(timer.current); timer.current = undefined;
 }, []);
 const cancel = useCallback(() => {
  stop(); setLoading(false); setFeedback(null);
 }, [stop]);
 // These are controlled inputs: also invalidate work if a parent changes them.
 useEffect(() => {
  cancel();
  return stop;
 }, [link, open, submitting, cancel, stop]);

 const markEdited = (field: "title" | "price" | "image") => { edits.current[field]++; };
 async function fill() {
  if (!open || submitting || active.current || !link.trim()) return;
  const controller = new AbortController();
  const request = ++version.current;
  const untouched = { ...edits.current };
  const empty = { title: !title.trim(), price: !price.trim(), image: !imageUrl };
  active.current = controller;
  setLoading(true); setFeedback(null);
  timer.current = setTimeout(() => {
   if (request !== version.current) return;
   stop(); setLoading(false);
   setFeedback({ kind: "error", message: "This lookup is taking too long. You can enter the details manually or try again." });
  }, 15_000);
  try {
   const result = await getProductSuggestions(link, controller.signal);
   if (request !== version.current || controller.signal.aborted) return;
   const details = result.details;
   if (empty.title && details.title && untouched.title === edits.current.title) {
    const suggestion = details.title;
    setTitle(current => current.trim() ? current : suggestion);
   }
   if (empty.price && details.priceCents !== null && untouched.price === edits.current.price) {
    const suggestion = (details.priceCents / 100).toFixed(2);
    setPrice(current => current.trim() ? current : suggestion);
   }
   const image = itemImageUrl(details.imageUrl);
   if (empty.image && image && untouched.image === edits.current.image) setImageUrl(current => current || image);
   setFeedback(details.title || details.priceCents !== null || image
    ? { kind: "success", message: "Review the details before saving. Your existing entries were kept; anything missing can be entered manually." }
    : { kind: "error", message: "We couldn’t find product details for this link. You can enter the details manually." });
  } catch (error) {
   if (request === version.current && !controller.signal.aborted) {
    setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Couldn’t look up this link. You can enter the details manually." });
   }
  } finally {
   if (request === version.current) {
    active.current = null; clearTimeout(timer.current); timer.current = undefined;
    setLoading(false);
   }
  }
 }
 return { loading, feedback, fill, cancel, markEdited };
}
